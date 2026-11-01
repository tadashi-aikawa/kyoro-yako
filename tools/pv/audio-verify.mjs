import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { audioPlan } from './audio.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const board = JSON.parse(await readFile(path.join(root, 'tools/pv/storyboard.json'), 'utf8'));
const plan = audioPlan(board.music, { duration: board.duration });
const music = path.join(root, board.music.path), video = path.join(root, '_Unversioned/pv/kyoro-yako-pv.mp4');
const out = path.join(root, '_Unversioned/pv'), rate = plan.sampleRate;
function run(command, args) {
  const result = spawnSync(command, args, { maxBuffer: 128 * 1024 * 1024, timeout: 60000, killSignal: 'SIGKILL' });
  if (result.status !== 0) throw new Error(`${command}: ${result.stderr?.toString()}`);
  return result.stdout;
}
const decode = file => run('ffmpeg', ['-v', 'error', '-i', file, '-vn', '-ar', String(rate), '-ac', '1', '-f', 'f32le', '-']);
const source = decode(music);
const sample = (bytes, n) => bytes.readFloatLE(n * 4);
const join = plan.joins[0], target = Math.round(join.start * rate), origin = Math.round(join.source * rate);
const fade = Math.round(plan.crossfade * rate);
// 元音源から接続の期待波形を独立に組む。完成AACとの比較で時間ずれを測る。
const expected = n => (n < 0 ? sample(source, target + n)
  : (n < fade ? sample(source, target + n) * Math.exp(-Math.log(100000) * n / fade) : 0)
    + sample(source, origin + n) * (plan.spliceFadeInSamples ? Math.min(1, n / plan.spliceFadeInSamples) : 1)) * (board.music.volume ?? 1);
function bestLag(reference, measured, start, end) {
  let best = { lagSamples: null, mse: Infinity }, energy = 0;
  for (let n = start; n < end; n += 3) energy += reference(n) ** 2;
  for (let lag = -128; lag <= 128; lag++) {
    let error = 0;
    for (let n = start; n < end; n += 3) error += (reference(n) - measured(n + lag)) ** 2;
    if (error < best.mse) best = { lagSamples: lag, mse: error };
  }
  return { lagSamples: best.lagSamples, relativeRms: Math.sqrt(best.mse / energy) };
}
const decoded = decode(video);
const aac = bestLag(expected, n => sample(decoded, target + n), 128, 22000);
if (aac.lagSamples !== 0 || aac.relativeRms > 0.15) throw new Error(`MP4のAACの接続が不一致: ${JSON.stringify(aac)}`);
const report = { joinSeconds: join.start, sampleRate: rate, targetSample: target, sourceSeconds: join.source,
  sourceSample: origin, spliceFadeInSamples: plan.spliceFadeInSamples, reference: '原曲PCMと既定のフェード曲線から再構成', aac };
{
  const mixed = Buffer.alloc(Math.round(rate * 0.6) * 4);
  for (let i = 0; i < mixed.length / 4; i++) mixed.writeFloatLE(expected(i - Math.round(rate * 0.1)), i * 4);
  await mkdir(path.join(out, 'review'), { recursive: true });
  const temporary = await mkdtemp(path.join(out, '.audio-'));
  try {
    const raw = path.join(temporary, 'mixed.f32'), png = path.join(temporary, 'wave.png');
    await writeFile(raw, mixed);
    // 上段は原曲から再構成したPCM、下段はMP4から復号したAAC。白線が90.29秒。
    const trim = `atrim=start=${join.start - 0.1}:end=${join.start + 0.5},asetpts=PTS-STARTPTS`;
    run('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(rate), '-ac', '1', '-i', raw, '-i', video,
      '-filter_complex', `[0:a]aformat=channel_layouts=mono[pcm];[1:a]aresample=${rate},aformat=channel_layouts=mono,${trim}[aac];[pcm][aac]amerge=inputs=2,showwavespic=s=1800x600:split_channels=1:colors=0x88d0bd|0xf3a5bd,drawbox=x=300:y=0:w=2:h=600:color=white:t=fill[wave]`,
      '-map', '[wave]', '-frames:v', '1', png]);
    run('cwebp', ['-quiet', '-q', '92', png, '-o', path.join(out, 'review/audio-splice.webp')]);
    report.wave = { from: join.start - 0.1, to: join.start + 0.5, markerX: 300, rows: ['原曲から再構成したPCM', '完成MP4のAAC'] };
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
await writeFile(path.join(out, 'audio-splice.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
