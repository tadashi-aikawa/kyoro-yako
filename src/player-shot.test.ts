import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => vi.unstubAllGlobals());

function start(power: number, focus = false): Game {
  const game = new Game(); game.audio.volume = 0;
  game.startStage(1); game.power = power; game.autoshot = true;
  if (focus) game.keys.add('ShiftLeft');
  return game;
}

it.each([false, true])('Power5の主攻撃はPower4と同じで、弱い補助弾を追加する: 低速=%s', (focus) => {
  const previous = start(4, focus); const maximum = start(5, focus);
  previous.frame = 9; maximum.frame = 9;
  previous.update(); maximum.update();
  const main = maximum.shots.objects.filter((s) => s.active && s.homing);
  expect(main).toEqual(previous.shots.objects.filter((s) => s.active));
  const sideShots = maximum.shots.objects.filter((s) => s.active && !s.homing);
  expect(sideShots).toHaveLength(4);
  if (focus) {
    expect(sideShots.every((s) => s.vx === 0 && s.vy === main[0].vy)).toBe(true);
  } else {
    for (const side of [-1, 1]) {
      const spread = sideShots.filter((s) => Math.sign(s.vx) === side);
      expect(spread).toHaveLength(2);
      const angles = spread.map((s) => Math.atan2(Math.abs(s.vx), -s.vy) * 180 / Math.PI).sort((a, b) => a - b);
      expect(angles[0]).toBeCloseTo(15); expect(angles[1]).toBeCloseTo(30);
    }
  }
  for (const shot of sideShots) {
    expect(shot.damage).toBeLessThan(main[0].damage);
    expect(shot.vy).toBeLessThan(0);
  }
});

it('低速へ切り替えると補助弾も正面へ集中し、解除すると斜め前方へ戻る', () => {
  const game = start(5);
  for (const focus of [false, true, false]) {
    game.shots.clear(); game.frame = 9;
    if (focus) game.keys.add('ShiftLeft'); else game.keys.delete('ShiftLeft');
    game.update();
    const extra = game.shots.objects.filter((s) => s.active && !s.homing);
    expect(extra).toHaveLength(4);
    expect(extra.every((s) => s.vx === 0)).toBe(focus);
  }
});

it.each([0, 1, 2, 3, 4, 4.99])('Power%sでは広角弾を撃たない', (power) => {
  const game = start(power); game.frame = 9; game.update();
  expect(game.shots.objects.filter((s) => s.active).every((s) => s.homing)).toBe(true);
});

it('左右の弾数は主攻撃より少なく、被弾でPower4へ落ちると広角弾の追加を止める', () => {
  const game = start(5);
  let main = 0; let side = 0;
  for (let i = 0; i < 60; i++) {
    game.shots.clear(); game.update();
    game.shots.forEach((s) => { if (s.homing) main++; else side++; });
  }
  expect(main).toBe(48); expect(side).toBe(24);
  game.pendingHit = 7; game.update();
  expect(game.power).toBe(4);
  game.shots.clear(); game.frame = 69; game.update();
  expect(game.shots.objects.filter((s) => s.active && !s.homing)).toHaveLength(0);
});

it.each([['small', 4.95], ['large', 4.5], ['small', 5], ['large', 5]] as const)('%sの取得でPower%sから5になり、上限を超えない', (kind, power) => {
  const game = start(power); const item = game.items.acquire()!;
  Object.assign(item, { x: game.px, y: game.py, vx: 0, vy: 0, kind, auto: false, manual: false });
  game.update(); expect(game.power).toBe(5);
});

it.each([['5', 5], ['99', 5], ['4.99', 4.99], ['-1', 0]])('開始クエリpower=%sは%sになる', (query, expected) => {
  vi.stubGlobal('location', { search: `?stage=1&power=${query}` });
  expect(new Game().power).toBe(expected);
});
