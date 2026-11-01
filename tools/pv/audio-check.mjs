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

test('20小節のサビは前区間だけを0.2秒延ばし、2区間目の頭を90.29秒に置く', () => {
  const plan = audioPlan({ ...music, segments: [{ from: 0, to: 90.29 }, { from: 152.48, to: 163.60 }] }, { duration: 101.4 });
  assert.ok(Math.abs(plan.contentDuration - 101.41) < 1e-8);
  assert.equal(plan.tailPadding, 0);
  assert.deepEqual(plan.joins, [{ start: 90.29, end: 90.49000000000001, source: 152.48 }]);
  assert.deepEqual(plan.sourceRanges, [{ from: 0, to: 90.49000000000001, pvStart: 0 }, { from: 152.48, to: 163.60, pvStart: 90.29 }]);
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

test('先行重ねは1小節・2小節とも原曲の一打を同じ整数サンプルへ固定する', () => {
  for (const overlap of [1.595, 3.19]) {
    const plan = audioPlan({ overlap, segments: [{ from: 0, to: 90.29 }, { from: 152.48, to: 163.60, cut: 'dawn' }] }, { duration: 101.4 });
    const next = plan.sourceRanges[1];
    assert.equal(next.pvStartSample + plan.overlapSamples, 3981789);
    assert.equal(next.sourceStartSample + plan.overlapSamples, 6724368);
    assert.equal(plan.contentDuration, 101.41);
    assert.equal(plan.tailPadding, 0);
    assert.deepEqual(audioAlignmentWarnings(plan, [{ id: 'dawn', start: 90.29 }]), []);
  }
});

test('実PCMの等パワー重ねはゲイン二乗和1、一打で後続ゲイン1、先行ゲイン0になる', () => {
  const plan = audioPlan({ segments: [{ from: 0, to: 2 }, { from: 4, to: 5 }], overlap: 0.5 }, { duration: 3 });
  const rate = 44100, input = new Float32Array(6 * rate * 2);
  for (let n = 0; n < 6 * rate; n++) input[n * 2 + (n < 3 * rate ? 0 : 1)] = 0.4;
  const result = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=d=6',
    '-f', 'f32le', '-ar', String(rate), '-ac', '2', '-i', 'pipe:0', '-filter_complex', plan.filter,
    '-map', '[music]', '-ar', String(rate), '-c:a', 'pcm_f32le', '-f', 'f32le', 'pipe:1'],
  { input: Buffer.from(input.buffer), timeout: 10000, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr.toString());
  const samples = new Float32Array(result.stdout.buffer, result.stdout.byteOffset, result.stdout.length / 4);
  for (let n = 0; n <= plan.overlapSamples; n++) {
    const at = (1.5 * rate + n) * 2, angle = Math.PI * n / plan.overlapSamples / 2;
    assert.ok(Math.abs(samples[at] - 0.4 * Math.cos(angle)) < 1e-6);
    assert.ok(Math.abs(samples[at + 1] - 0.4 * Math.sin(angle)) < 1e-6);
    assert.ok(Math.abs((samples[at] ** 2 + samples[at + 1] ** 2) / 0.16 - 1) < 1e-6);
  }
  assert.equal(samples[2 * rate * 2], 0);
  assert.ok(Math.abs(samples[2 * rate * 2 + 1] - 0.4) < 1e-6);
});

test('先行重ねの試写は本編の同一PCMを切り出し、無効な重なりを拒否する', () => {
  const config = { ...music, fadeOut: 0, overlap: 0.5 };
  const full = pcm(audioPlan(config, { duration: 4 }));
  const preview = pcm(audioPlan(config, { duration: 4, from: 1.2, to: 2.3, partial: true }));
  assert.deepEqual(preview, full.subarray(Math.round(1.2 * 44100) * 2, Math.round(2.3 * 44100) * 2));
  for (const overlap of [-1, NaN, 3]) assert.throws(() => audioPlan({ ...music, overlap }, { duration: 4 }), /overlap/);
  assert.throws(() => audioPlan({ overlap: 1, segments: [{ from: 0, to: 2 }, { from: 0.5, to: 4 }] }, { duration: 5.5 }), /overlap/);
});

test('hsinは同相の大音量2区間を重ねても増幅せず、前後の音量と一打の位置を維持する', () => {
  const rate = 44100, config = { segments: [{ from: 0, to: 2 }, { from: 4, to: 5 }], overlap: 0.5, overlapCurve: 'hsin' };
  const plan = audioPlan(config, { duration: 3 });
  const input = new Float32Array(6 * rate * 2);
  for (let n = 0; n < 6 * rate; n++) {
    input[n * 2] = 0.95;
    input[n * 2 + 1] = n < 3 * rate ? 0 : 0.8;
  }
  const result = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=d=6',
    '-f', 'f32le', '-ar', String(rate), '-ac', '2', '-i', 'pipe:0', '-filter_complex', plan.filter,
    '-map', '[music]', '-c:a', 'pcm_f32le', '-f', 'f32le', 'pipe:1'],
  { input: Buffer.from(input.buffer), timeout: 10000, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr.toString());
  const samples = new Float32Array(result.stdout.buffer, result.stdout.byteOffset, result.stdout.length / 4);
  assert.equal(samples.length, 3 * rate * 2);
  for (let n = 0; n < 3 * rate; n++) assert.ok(Math.abs(samples[n * 2] - 0.95) < 1e-6);
  assert.equal(samples[(1.5 * rate) * 2 + 1], 0);
  assert.ok(Math.abs(samples[(1.75 * rate) * 2 + 1] - 0.4) < 1e-6);
  assert.ok(Math.abs(samples[2 * rate * 2 + 1] - 0.8) < 1e-6);
  assert.throws(() => audioPlan({ ...config, overlapCurve: 'invalid' }, { duration: 3 }), /overlapCurve/);
});
