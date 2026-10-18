import { expect, it } from 'vitest';
import { bossSpriteId, createBossMotion, IDLE_STEP, updateBossMotion } from './boss-motion';

function drive(xs: number[], key = 'jinrai:phase', start = 0) {
  const motion = createBossMotion();
  return { motion, poses: xs.map((x, i) => updateBossMotion(motion, key, start + i, x)) };
}

it('止まっている間は待機のまま', () => {
  expect(drive(Array(60).fill(192)).poses.every((pose) => pose === 'idle')).toBe(true);
});

it('左右へ動くと向きの絵へ切り替わる', () => {
  expect(drive(Array.from({ length: 30 }, (_, i) => 192 - i)).poses.at(-1)).toBe('left');
  expect(drive(Array.from({ length: 30 }, (_, i) => 192 + i)).poses.at(-1)).toBe('right');
});

it('ボスの通常の揺れでは折り返しの前後だけ待機になる', () => {
  const xs = Array.from({ length: 600 }, (_, i) => 192 + Math.sin(i * 0.012) * 42);
  const poses = drive(xs).poses.slice(60);
  expect(poses).toContain('idle');
  expect(poses).toContain('left');
  expect(poses).toContain('right');
});

it('しきい値付近の小さな揺れで待機と移動を行き来しない', () => {
  const xs: number[] = [192];
  for (let i = 1; i < 120; i++) xs.push(xs[i - 1] - (i < 40 ? 1 : 0.22 + (i % 2) * 0.04));
  const poses = drive(xs).poses.slice(40);
  expect(poses.every((pose) => pose === 'left')).toBe(true);
});

it('迅雷の駆け抜けは移動として扱い、止まると待機へ戻る', () => {
  const xs = [...Array(10).fill(24), ...Array.from({ length: 22 }, (_, i) => 24 + (i + 1) * 16), ...Array(60).fill(376)];
  const { poses } = drive(xs);
  expect(poses[31]).toBe('right');
  expect(poses.at(-1)).toBe('idle');
});

it('フェーズの切り替えと瞬間移動では待機から数え直す', () => {
  const { motion } = drive(Array.from({ length: 30 }, (_, i) => 192 - i));
  expect(updateBossMotion(motion, 'jinrai:next', 30, 100)).toBe('idle');
  expect(updateBossMotion(motion, 'jinrai:next', 31, 300)).toBe('idle');
});

it('同じフレームの再描画では状態を進めない', () => {
  const { motion } = drive(Array.from({ length: 30 }, (_, i) => 192 - i));
  const vx = motion.vx;
  expect(updateBossMotion(motion, 'jinrai:phase', 29, 0)).toBe('left');
  expect(motion.vx).toBe(vx);
});

it('待機中は元絵と待機絵を交互に出し、対象外のボスは元絵のまま', () => {
  expect(bossSpriteId('jinrai', 'idle', 0)).toBe('jinrai');
  expect(bossSpriteId('jinrai', 'idle', IDLE_STEP)).toBe('jinrai-idle');
  expect(bossSpriteId('jinrai', 'left', 5)).toBe('jinrai-left');
  expect(bossSpriteId('obsidia', 'right', 5)).toBe('obsidia');
});
