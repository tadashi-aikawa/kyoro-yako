import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { audioPlan } from './audio.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const board = JSON.parse(await readFile(path.join(root, 'tools/pv/storyboard.json'), 'utf8'));
const args = process.argv.slice(2);
const value = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const config = { ...board.music, overlap: Number(value('--overlap', board.music.overlap ?? 0)) };
const plan = audioPlan(config, { duration: board.duration });
const music = path.join(root, board.music.path), video = path.resolve(value('--video', path.join(root, '_Unversioned/pv/kyoro-yako-pv.mp4')));
const videoOffset = Number(value('--video-offset', 0));
const reportPath = path.resolve(value('--report', path.join(root, '_Unversioned/pv/audio-splice.json')));
const wavePath = args.includes('--report') ? reportPath.replace(/\.json$/, '.webp') : path.join(root, '_Unversioned/pv/review/audio-splice.webp');
const out = path.join(root, '_Unversioned/pv'), rate = plan.sampleRate;
function run(command, args) {
  const result = spawnSync(command, args, { maxBuffer: 128 * 1024 * 1024, timeout: 60000, killSignal: 'SIGKILL' });
  if (result.status !== 0) throw new Error(`${command}: ${result.stderr?.toString()}`);
  return result.stdout;
}
const decode = (file, channels = 1) => run('ffmpeg', ['-v', 'error', '-i', file, '-vn', '-ar', String(rate), '-ac', String(channels), '-f', 'f32le', '-']);
const source = decode(music);
const sample = (bytes, n) => bytes.readFloatLE(n * 4);
const join = plan.joins[0], target = Math.round(join.start * rate), origin = Math.round(join.source * rate);
const fade = Math.round(plan.crossfade * rate);
// 元音源から接続の期待波形を独立に組む。完成AACとの比較で時間ずれを測る。
const gains = n => {
  const x = Math.max(0, Math.min(1, 1 + n / plan.overlapSamples));
  const a = Math.cos(Math.PI * x / 2), b = Math.sin(Math.PI * x / 2);
  return plan.overlapCurve === 'hsin' ? [a * a, b * b] : [a, b];
};
const expected = n => (plan.overlapSamples
  ? n < -plan.overlapSamples ? sample(source, target + n)
    : n >= 0 ? sample(source, origin + n)
      : sample(source, target + n) * gains(n)[0] + sample(source, origin + n) * gains(n)[1]
  : n < 0 ? sample(source, target + n)
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
const decodedTarget = target - Math.round(videoOffset * rate);
const aac = bestLag(expected, n => sample(decoded, decodedTarget + n), 128, 22000);
if (aac.lagSamples !== 0 || aac.relativeRms > 0.15) throw new Error(`MP4のAACの接続が不一致: ${JSON.stringify(aac)}`);
const report = { joinSeconds: join.start, sampleRate: rate, targetSample: target, sourceSeconds: join.source,
  sourceSample: origin, spliceFadeInSamples: plan.spliceFadeInSamples, overlapSamples: plan.overlapSamples, overlapCurve: plan.overlapCurve,
  overlapStart: plan.joins[0].overlapStart, sourceStart: plan.joins[0].sourceStart,
  anchorGains: plan.overlapSamples ? { outgoing: 0, incoming: 1 } : null,
  reference: '原曲PCMと既定のフェード曲線から再構成', aac };
if (plan.overlapSamples) {
  // 音楽自体の強弱とミックスによる増減を区別する。L/Rのエネルギーを合算する。
  const stereo = decode(music, 2), actual = decode(video, 2), windows = [];
  const width = Math.round(0.4 * rate), step = Math.round(0.1 * rate);
  const begin = Math.floor((join.overlapStart - 0.8) * rate), end = Math.round((join.start + 0.8) * rate);
  const pcmPlan = audioPlan(config, { duration: board.duration, from: begin / rate, to: end / rate, partial: true });
  const pcm = run('ffmpeg', ['-v', 'error', '-i', video, '-i', music, '-filter_complex', pcmPlan.filter,
    '-map', '[music]', '-t', String((end - begin) / rate), '-c:a', 'pcm_f32le', '-f', 'f32le', '-']);
  let peak = 0, overSamples = 0, maxError = 0, peakFrame = 0;
  for (let at = begin; at < end; at++) {
    const n = at - target, [a, b] = gains(n);
    for (let c = 0; c < 2; c++) {
      const measured = sample(pcm, (at - begin) * 2 + c);
      const reference = (sample(stereo, at * 2 + c) * a + sample(stereo, (origin + n) * 2 + c) * b) * (config.volume ?? 1);
      maxError = Math.max(maxError, Math.abs(measured - reference));
      if (at >= target - plan.overlapSamples && at < target) {
        if (Math.abs(measured) > 1) overSamples++;
        if (Math.abs(measured) > peak) { peak = Math.abs(measured); peakFrame = at; }
      }
    }
  }
  report.overlapPcm = { peakAmplitude: peak, peakDb: 20 * Math.log10(peak), peakSeconds: peakFrame / rate, overSamples,
    maxErrorFromUnclippedSum: maxError, passed: overSamples === 0 && maxError < 1e-6 };
  for (let at = begin; at + width <= end; at += step) {
    let referencePower = 0, mixedPower = 0, actualPower = 0, peak = 0, mixedPeak = 0;
    for (let k = 0; k < width; k++) {
      const n = at + k - target, [outGain, inGain] = gains(n);
      for (let c = 0; c < 2; c++) {
        const outgoing = sample(stereo, (target + n) * 2 + c) * outGain;
        const incoming = sample(stereo, (origin + n) * 2 + c) * inGain;
        const actualSample = sample(actual, (at + k - Math.round(videoOffset * rate)) * 2 + c);
        referencePower += (outgoing ** 2 + incoming ** 2) * (config.volume ?? 1) ** 2;
        mixedPower += ((outgoing + incoming) * (config.volume ?? 1)) ** 2;
        mixedPeak = Math.max(mixedPeak, Math.abs((outgoing + incoming) * (config.volume ?? 1)));
        actualPower += actualSample ** 2;
        peak = Math.max(peak, Math.abs(actualSample));
      }
    }
    const db = power => 10 * Math.log10(power / (width * 2));
    windows.push({ from: at / rate, to: (at + width) / rate, referenceDb: db(referencePower), mixedDb: db(mixedPower),
      aacDb: db(actualPower), mixDeviationDb: 10 * Math.log10(mixedPower / referencePower),
      aacDeviationDb: 10 * Math.log10(actualPower / referencePower), peakDb: 20 * Math.log10(peak), mixedPeakDb: 20 * Math.log10(mixedPeak) });
  }
  const deviations = windows.map(w => w.aacDeviationDb);
  report.rms = { windowSeconds: 0.4, stepSeconds: 0.1, reference: '原曲2区間のゲイン二乗重み付きパワー。相互相関項を除く',
    minDeviationDb: Math.min(...deviations), maxDeviationDb: Math.max(...deviations),
    minDb: Math.min(...windows.map(w => w.aacDb)), maxDb: Math.max(...windows.map(w => w.aacDb)),
    maxPeakDb: Math.max(...windows.map(w => w.peakDb)), maxMixedPeakDb: Math.max(...windows.map(w => w.mixedPeakDb)), windows };
  // 接続が作る±1dB超の谷・山、0dBFS以上のピークを検出する。
  report.rms.passed = deviations.every(db => Math.abs(db) <= 1) && report.rms.maxPeakDb < 0;
}
{
  const waveFrom = plan.overlapSamples ? join.overlapStart - 0.8 : join.start - 0.1;
  const waveTo = plan.overlapSamples ? join.start + 0.8 : join.start + 0.5;
  const markerX = Math.round((join.start - waveFrom) / (waveTo - waveFrom) * 1800);
  const mixed = Buffer.alloc((Math.round(waveTo * rate) - Math.round(waveFrom * rate)) * 4);
  for (let i = 0; i < mixed.length / 4; i++) mixed.writeFloatLE(expected(i + Math.round(waveFrom * rate) - target), i * 4);
  await mkdir(path.join(out, 'review'), { recursive: true });
  const temporary = await mkdtemp(path.join(out, '.audio-'));
  try {
    const raw = path.join(temporary, 'mixed.f32'), png = path.join(temporary, 'wave.png');
    await writeFile(raw, mixed);
    // 上段は原曲から再構成したPCM、下段はMP4から復号したAAC。白線が90.29秒。
    const trim = `atrim=start=${waveFrom - videoOffset}:end=${waveTo - videoOffset},asetpts=PTS-STARTPTS`;
    run('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(rate), '-ac', '1', '-i', raw, '-i', video,
      '-filter_complex', `[0:a]aformat=channel_layouts=mono[pcm];[1:a]aresample=${rate},aformat=channel_layouts=mono,${trim}[aac];[pcm][aac]amerge=inputs=2,showwavespic=s=1800x600:split_channels=1:colors=0x88d0bd|0xf3a5bd,drawbox=x=${markerX}:y=0:w=2:h=600:color=white:t=fill[wave]`,
      '-map', '[wave]', '-frames:v', '1', png]);
    await mkdir(path.dirname(wavePath), { recursive: true });
    run('cwebp', ['-quiet', '-q', '92', png, '-o', wavePath]);
    report.wave = { from: waveFrom, to: waveTo, markerX, rows: ['原曲から再構成したPCM', '完成MP4のAAC'] };
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.rms && !report.rms.passed) throw new Error('RMS検査で接続由来の谷・山またはクリップ候補を検出しました。report.rmsを確認してください');
if (plan.overlapCurve === 'hsin' && !report.overlapPcm?.passed) throw new Error('AAC前の重なりPCMが1.0を超えるか、カーブの期待値と一致しません');
