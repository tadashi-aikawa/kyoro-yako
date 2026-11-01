import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { audioPlan } from './audio.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const board = JSON.parse(await readFile(path.join(root, 'tools/pv/storyboard.json'), 'utf8'));
const directory = path.join(root, '_Unversioned/pv/review/splice');
await mkdir(directory, { recursive: true });
const music = path.join(root, board.music.path), video = path.join(root, '_Unversioned/pv/round14-first.mp4');
function run(args) {
  const result = spawnSync('ffmpeg', ['-v', 'error', ...args], { maxBuffer: 128 * 1024 * 1024, timeout: 30000, killSignal: 'SIGKILL' });
  if (result.status !== 0) throw new Error(result.stderr.toString());
  return new Float32Array(result.stdout.buffer, result.stdout.byteOffset, result.stdout.length / 4);
}
const source = run(['-i', music, '-ar', '44100', '-ac', '2', '-f', 'f32le', '-']);
const actual = run(['-i', video, '-vn', '-ar', '44100', '-ac', '2', '-f', 'f32le', '-']);
const rate = 44100, target = Math.round(90.29 * rate), origin = Math.round(152.48 * rate);
const count = Math.round(board.music.overlap * rate), begin = target - count;
function peakOf(get, from, to) {
  let peak = { amplitude: 0 }, overSamples = 0;
  for (let n = from; n < to; n++) for (let c = 0; c < 2; c++) {
    const value = get(n, c);
    if (Math.abs(value) > 1) overSamples++;
    if (Math.abs(value) > peak.amplitude) peak = { amplitude: Math.abs(value), value, frame: n, time: n / rate, channel: c ? 'R' : 'L' };
  }
  return { ...peak, db: 20 * Math.log10(peak.amplitude), overSamples };
}
const mixes = {};
for (const curve of ['qsin', 'hsin']) {
  const gains = frame => {
    const angle = Math.PI * (frame - begin) / count / 2;
    return curve === 'qsin' ? [Math.cos(angle), Math.sin(angle)] : [Math.cos(angle) ** 2, Math.sin(angle) ** 2];
  };
  const mix = (frame, channel) => {
    const [a, b] = gains(frame);
    return source[frame * 2 + channel] * a + source[(origin + frame - target) * 2 + channel] * b;
  };
  const peak = peakOf(mix, begin, target), c = peak.channel === 'R' ? 1 : 0;
  const [outGain, inGain] = gains(peak.frame);
  mixes[curve] = { peak, atPeak: { outgoingSourceTime: peak.time, incomingSourceTime: (origin + peak.frame - target) / rate,
    outgoingValue: source[peak.frame * 2 + c], incomingValue: source[(origin + peak.frame - target) * 2 + c],
    outGain, inGain, gainSum: outGain + inGain, aacValue: actual[peak.frame * 2 + c] } };
}
// エンコーダー直前と同じフィルター出力を浮動小数点PCMへ分岐して実測する。
const plan = audioPlan({ ...board.music, overlapCurve: 'qsin' }, { duration: board.duration, from: 85, to: 95, partial: true });
const pcm = run(['-i', video, '-i', music, '-filter_complex', plan.filter, '-map', '[music]', '-t', '10', '-c:a', 'pcm_f32le', '-f', 'f32le', '-']);
const correctedPlan = audioPlan({ ...board.music, overlapCurve: 'hsin' }, { duration: board.duration, from: 85, to: 95, partial: true });
const correctedPcm = run(['-i', video, '-i', music, '-filter_complex', correctedPlan.filter, '-map', '[music]', '-t', '10', '-c:a', 'pcm_f32le', '-f', 'f32le', '-']);
let changedOutsideOverlap = 0;
for (let n = 85 * rate; n < 95 * rate; n++) {
  if (n >= begin && n < target) continue;
  for (let c = 0; c < 2; c++) if (pcm[(n - 85 * rate) * 2 + c] !== correctedPcm[(n - 85 * rate) * 2 + c]) changedOutsideOverlap++;
}
let maxError = 0;
for (let n = begin; n < target; n++) for (let c = 0; c < 2; c++) {
  const x = (n - begin) / count, a = Math.cos(Math.PI * x / 2), b = Math.sin(Math.PI * x / 2);
  const expected = source[n * 2 + c] * a + source[(origin + n - target) * 2 + c] * b;
  maxError = Math.max(maxError, Math.abs(expected - pcm[(n - 85 * rate) * 2 + c]));
}
const report = { sampleRate: rate, overlap: { from: begin / rate, to: target / rate },
  outgoingSource: peakOf((n, c) => source[n * 2 + c], begin, target),
  incomingSource: peakOf((n, c) => source[n * 2 + c], origin - count, origin), mixes,
  filterPcm: { ...peakOf((n, c) => pcm[(n - 85 * rate) * 2 + c], begin, target), maxErrorFromUnclippedSum: maxError },
  correctedFilterPcm: { ...peakOf((n, c) => correctedPcm[(n - 85 * rate) * 2 + c], begin, target), changedOutsideOverlap },
  aac: peakOf((n, c) => actual[n * 2 + c], begin, target) };
await writeFile(path.join(directory, 'peak-diagnosis.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
