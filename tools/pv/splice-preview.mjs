import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { audioPlan } from './audio.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const video = args.includes('--video') ? path.resolve(args[args.indexOf('--video') + 1]) : path.join(root, '_Unversioned/pv/kyoro-yako-pv.mp4');
const board = JSON.parse(await readFile(path.join(root, 'tools/pv/storyboard.json'), 'utf8'));
const directory = path.join(root, '_Unversioned/pv/review/splice');
await mkdir(directory, { recursive: true });
function run(command, argv) {
  const result = spawnSync(command, argv, { timeout: 120000, killSignal: 'SIGKILL', maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command}: ${result.stderr.toString()}`);
  return result.stdout.toString();
}
const hashVideo = (file, seek = 0) => run('ffmpeg', ['-v', 'error', '-ss', String(seek), '-i', file,
  '-t', '10', '-map', '0:v:0', '-an', '-pix_fmt', 'yuv420p', '-f', 'hash', '-hash', 'sha256', '-']).trim();
const sourceHash = hashVideo(video, 85), reports = [];
for (const [index, overlap] of [1.595, 3.19].entries()) {
  const name = `splice-${index + 1}bar`, destination = path.join(directory, `${name}.mp4`);
  const plan = audioPlan({ ...board.music, overlap }, { duration: board.duration, from: 85, to: 95, partial: true });
  // 一般的なプレイヤーで再生できるHighプロファイル。2案目は同じ映像ストリームをコピーする。
  const input = index ? ['-i', path.join(directory, 'splice-1bar.mp4')] : ['-ss', '85', '-i', video];
  const encoding = index ? ['-c:v', 'copy'] : ['-c:v', 'libx264', '-profile:v', 'high', '-crf', '16', '-preset', 'veryfast', '-threads', '1',
    '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
  run('ffmpeg', ['-v', 'error', '-y', ...input, '-i', path.join(root, board.music.path),
    '-filter_complex', plan.filter, '-map', '0:v:0', '-map', '[music]', ...encoding, '-c:a', 'aac', '-b:a', '256k',
    '-t', '10', '-movflags', '+faststart', destination]);
  const pixelHash = hashVideo(destination);
  if (index && pixelHash !== reports[0].pixelHash) throw new Error(`${name}: 比較する2案の映像画素が一致しません`);
  const comparison = index ? reports[0].comparison : (() => {
    const stats = run('ffmpeg', ['-v', 'error', '-ss', '85', '-i', video, '-i', destination,
      '-filter_complex', '[0:v]trim=duration=10,setpts=PTS-STARTPTS[ref];[1:v]setpts=PTS-STARTPTS[clip];[ref][clip]ssim=stats_file=-',
      '-an', '-t', '10', '-f', 'null', '-']);
    const values = [...stats.matchAll(/All:([\d.]+)/g)].map(match => Number(match[1]));
    if (values.length !== 600 || Math.min(...values) < 0.97) throw new Error('本編の同時刻フレームとの画質検査に失敗しました');
    return { frames: values.length, meanSsim: values.reduce((a, b) => a + b, 0) / values.length, minSsim: Math.min(...values) };
  })();
  const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,nb_frames,color_space', '-of', 'json', destination]));
  if (Number(probe.format.duration) !== 10 || !probe.streams.some(s => s.codec_name === 'aac') || !probe.streams.some(s => s.codec_type === 'video' && Number(s.nb_frames) === 600)) throw new Error(`${name}: 試聴動画の仕様検査に失敗しました`);
  reports.push({ name, from: 85, to: 95, overlap, audio: plan, pixelHash, sourceHash, comparison, probe });
  console.log(`${name}: 10秒・600フレーム・AAC。本編の同時刻映像との平均SSIM=${comparison.meanSsim}。`);
}
await writeFile(path.join(directory, 'previews.json'), JSON.stringify(reports, null, 2));
