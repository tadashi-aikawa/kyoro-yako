import { expect, it } from 'vitest';
import { bossSpriteId, CAST_FRAMES, CAST_GAP, createBossMotion, IDLE_STEP, isCasting, MOTION_SPRITES, SPELL_CAST_FRAMES, updateBossMotion } from './boss-motion';
import type { Game } from './game';
import { normalBeat } from './patterns/boss-normal';
import { STAGES } from './stages';

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

it('待機中は元絵と待機絵を交互に出し、対象外は元絵のまま', () => {
  expect(bossSpriteId('jinrai', 'idle', 0)).toBe('jinrai');
  expect(bossSpriteId('jinrai', 'idle', IDLE_STEP)).toBe('jinrai-idle');
  expect(bossSpriteId('jinrai', 'left', 5)).toBe('jinrai-left');
  expect(bossSpriteId('mimiko', 'right', 5)).toBe('mimiko');
});

it('元絵を描き直したボスは待機の片方に描き直しを使う', () => {
  expect(bossSpriteId('neo', 'idle', 0)).toBe('neo-base');
  expect(bossSpriteId('neo', 'idle', IDLE_STEP)).toBe('neo-idle');
  expect(bossSpriteId('etokichi', 'idle', 0)).toBe('etokichi');
});

it('中ボス・ボスの全員が待機・左右・構えの絵を持ち、配置済みの画像を指す', () => {
  for (const stage of STAGES) for (const id of [stage.mid, stage.boss]) {
    for (const pose of ['idle', 'left', 'right', 'cast']) expect(MOTION_SPRITES).toContain(`${id}-${pose}`);
  }
  const placed = Object.keys(import.meta.glob('/public/assets/sprites/*.webp'));
  for (const id of MOTION_SPRITES) expect(placed, id).toContain(`/public/assets/sprites/${id}.webp`);
});

it('スペルは宣言のカットインが明けて撃ち始める瞬間だけ構える', () => {
  expect(isCasting('spell', 0, 0)).toBe(false);
  expect(isCasting('spell', 105, 0)).toBe(true);
  expect(isCasting('midboss', 105 + SPELL_CAST_FRAMES - 1, 0)).toBe(true);
  expect(isCasting('spell', 105 + SPELL_CAST_FRAMES, 0)).toBe(false);
  expect(isCasting('spell', 400, 0)).toBe(false);
});

it('通常攻撃は一斉射の頭で構え、周期が短い技でも間隔を空ける', () => {
  expect(isCasting('normal', 50, 84)).toBe(false);
  expect(isCasting('normal', 105, 84)).toBe(true);
  expect(isCasting('normal', 105 + CAST_FRAMES, 84)).toBe(false);
  expect(isCasting('normal', 105 + 84, 84)).toBe(true);
  const frames = Array.from({ length: 600 }, (_, i) => 105 + i).filter((f) => isCasting('normal', f, 21));
  expect(frames.length).toBeLessThan(600 * CAST_FRAMES / CAST_GAP + CAST_FRAMES);
  expect(frames.every((f) => (f - 105) % 21 < CAST_FRAMES)).toBe(true);
});

it('構えは移動より優先し、全ての通常攻撃が一斉射の周期を持つ', () => {
  expect(bossSpriteId('obsidia', 'cast', 3)).toBe('obsidia-cast');
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    for (const stage of STAGES) for (const phase of stage.phases.filter((p) => p.kind === 'normal')) {
      expect(normalBeat({ difficulty } as Game, phase.pattern), phase.pattern).toBeGreaterThan(0);
    }
  }
});
