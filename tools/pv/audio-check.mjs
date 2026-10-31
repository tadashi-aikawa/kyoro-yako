import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { audioPlan, validateAudioSource, audioAlignmentWarnings } from './audio.mjs';

const music = { segments: [{ from: 0, to: 2 }, { from: 4, to: 6 }], fadeOut: 1, volume: 0.5 };
function pcm(plan) {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=d=6', '-f', 'lavfi',
    '-i', 'aevalsrc=sin(2*PI*(200+100*t)*t):s=44100:d=6', '-filter_complex', plan.filter,
    '-map', '[music]', '-ar', '44100', '-c:a', 'pcm_s16le', '-f', 's16le', 'pipe:1'], { timeout: 10000, killSignal: 'SIGKILL' });
  assert.equal(result.status, 0, result.stderr.toString());
  return result.stdout;
}

test('ミックスをまたぐ試写は完成タイムラインの同じ音位置になる', () => {
  const full = pcm(audioPlan({ ...music, fadeOut: 0 }, { duration: 4 }));
  const preview = audioPlan(music, { duration: 4, from: 1.7, to: 2.3, partial: true });
  assert.equal(preview.fadeOut, 0);
  assert.deepEqual(pcm(preview), full.subarray(Math.round(1.7 * 44100) * 2, Math.round(2.3 * 44100) * 2));
  assert.equal(full.length, 4 * 44100 * 2);
});

test('B案は前区間だけを0.2秒延ばし、2区間目の頭を83.91秒に置く', () => {
  const plan = audioPlan({ ...music, segments: [{ from: 0, to: 83.91 }, { from: 152.48, to: 170 }] }, { duration: 101.4 });
  assert.ok(Math.abs(plan.contentDuration - 101.43) < 1e-8);
  assert.equal(plan.tailPadding, 0);
  assert.deepEqual(plan.joins, [{ start: 83.91, end: 84.11, source: 152.48 }]);
  assert.deepEqual(plan.sourceRanges, [{ from: 0, to: 84.11, pvStart: 0 }, { from: 152.48, to: 170, pvStart: 83.91 }]);
});

test('3区間でもクロスフェードによる開始時刻の前倒しが累積しない', () => {
  const plan = audioPlan({ segments: [{ from: 0, to: 1 }, { from: 2, to: 3 }, { from: 4, to: 5 }] }, { duration: 3 });
  assert.deepEqual(plan.sourceRanges.map(s => s.pvStart), [0, 1, 2]);
  assert.equal(pcm(plan).length, 3 * 44100 * 2);
});

test('実PCMは指定時刻から44サンプルで直線的に立ち上がり、その後ゲイン1になる', () => {
  const plan = audioPlan({ segments: [{ from: 0, to: 2 }, { from: 4, to: 5 }], volume: 1 }, { duration: 3 });
  const input = new Float32Array(6 * 44100);
  input.fill(0.8, 4 * 44100);
  const result = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=d=6',
    '-f', 'f32le', '-ar', '44100', '-ac', '1', '-i', 'pipe:0', '-filter_complex', plan.filter,
    '-map', '[music]', '-ar', '44100', '-c:a', 'pcm_s16le', '-f', 's16le', 'pipe:1'],
  { input: Buffer.from(input.buffer), timeout: 10000, killSignal: 'SIGKILL' });
  assert.equal(result.status, 0, result.stderr.toString());
  const samples = new Int16Array(result.stdout.buffer, result.stdout.byteOffset, result.stdout.length / 2);
  assert.ok(samples.subarray(0, 88200).every(s => s === 0));
  for (let n = 0; n <= 44; n++) assert.ok(Math.abs(samples[88200 + n] / 32768 - 0.8 * n / 44) < 0.0001);
  assert.ok(Math.abs(samples[88245] / 32768 - 0.8) < 0.0001);
  assert.ok(Math.abs(samples[132299] / 32768 - 0.8) < 0.0001);
});

test('前区間は接続前まで無変更で、延長部分だけ指数フェードする', () => {
  const plan = audioPlan({ segments: [{ from: 0, to: 2 }, { from: 4, to: 5 }] }, { duration: 3 });
  const input = new Float32Array(6 * 44100);
  input.fill(0.8, 0, 3 * 44100);
  const result = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=d=6',
    '-f', 'f32le', '-ar', '44100', '-ac', '1', '-i', 'pipe:0', '-filter_complex', plan.filter,
    '-map', '[music]', '-ar', '44100', '-c:a', 'pcm_f32le', '-f', 'f32le', 'pipe:1'],
  { input: Buffer.from(input.buffer), timeout: 10000, killSignal: 'SIGKILL' });
  assert.equal(result.status, 0, result.stderr.toString());
  const samples = new Float32Array(result.stdout.buffer, result.stdout.byteOffset, result.stdout.length / 4);
  assert.ok(samples.subarray(0, 88200).every(s => Math.abs(s - 0.8) < 1e-6));
  assert.ok(Math.abs(samples[92610] - 0.8 * Math.exp(-Math.log(100000) / 2)) < 1e-6);
  assert.ok(samples.subarray(97021).every(s => s === 0));
});

test('直線フェードインは最大5msに制限する', () => {
  assert.throws(() => audioPlan({ ...music, spliceFadeIn: 0.006 }, { duration: 4 }), /spliceFadeIn/);
  assert.throws(() => audioPlan({ ...music, spliceFadeIn: -0.001 }, { duration: 4 }), /spliceFadeIn/);
  const plan = audioPlan({ ...music, spliceFadeIn: 0.005 }, { duration: 4 });
  assert.equal(plan.spliceFadeInSamples, 220);
  assert.ok(plan.spliceFadeInSeconds <= 0.005);
});

test('旧offset形式とクロスフェードなしのconcatを扱える', () => {
  assert.deepEqual(audioPlan({ offset: 2, fadeOut: 1 }, { duration: 3 }).segments, [{ from: 2, to: 5 }]);
  const plan = audioPlan({ ...music, crossfade: 0 }, { duration: 4 });
  assert.match(plan.filter, /concat=n=2:v=0:a=1/);
  assert.equal(pcm(plan).length, 4 * 44100 * 2);
});

test('逆順の区間や長すぎるクロスフェードはエラーになる', () => {
  assert.throws(() => audioPlan({ segments: [{ from: 2, to: 1 }] }, { duration: 4 }));
  assert.throws(() => audioPlan({ ...music, crossfade: 3 }, { duration: 4 }));
});

test('延長部分が原曲の長さを超えたらエラーになる', () => {
  const plan = audioPlan({ segments: [{ from: 4, to: 6 }, { from: 0, to: 1 }] }, { duration: 3 });
  assert.throws(() => validateAudioSource(plan, 6), /6.2/);
  assert.doesNotThrow(() => validateAudioSource(plan, 6.2));
});

test('音楽区間の開始時刻と対応カットの時刻が違えば警告する', () => {
  const plan = audioPlan({ segments: [{ from: 0, to: 2 }, { from: 4, to: 5, cut: 'dawn' }] }, { duration: 3 });
  assert.deepEqual(audioAlignmentWarnings(plan, [{ id: 'dawn', start: 2 }]), []);
  assert.match(audioAlignmentWarnings(plan, [{ id: 'dawn', start: 2.2 }])[0], /dawn/);
});
