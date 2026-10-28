import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { obsidiaPosition } from './obsidia-movement';
import { MID_PHASE, STAGES } from './stages';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => vi.unstubAllGlobals());

it('2面の全移動は画面上部に収まり、宣言・周期の境目でも位置が飛ばない', () => {
  for (const phase of [MID_PHASE.obsidia, ...STAGES[1].phases].filter((p) => p.pattern !== 'sweep')) {
    let previous = obsidiaPosition(phase.pattern, 0, [284, 150]);
    for (let frame = 1; frame <= phase.duration * 60; frame++) {
      const position = obsidiaPosition(phase.pattern, frame, [284, 150]);
      expect(position[0]).toBeGreaterThanOrEqual(96);
      expect(position[0]).toBeLessThanOrEqual(288);
      expect(position[1]).toBeGreaterThanOrEqual(60);
      expect(position[1]).toBeLessThanOrEqual(158);
      expect(Math.hypot(position[0] - previous[0], position[1] - previous[1])).toBeLessThan(4);
      previous = position;
    }
  }
});

it('巡回・中ボス・タグの移動には停止時間と上下左右の移動がある', () => {
  for (const pattern of ['obsidiaShelves', 'bookshelf', 'tags']) {
    const points = Array.from({ length: 1200 }, (_, t) => obsidiaPosition(pattern, 105 + t, [192, 132]));
    const stops = points.filter((p, i) => i > 0 && p[0] === points[i - 1][0] && p[1] === points[i - 1][1]);
    expect(stops.length).toBeGreaterThan(300);
    expect(Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0]))).toBeGreaterThan(140);
    expect(Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1]))).toBeGreaterThan(30);
  }
});

it('弧と8の字は左右と上下へ動き、巡回とは異なる軌道を通る', () => {
  for (const pattern of ['clean', 'obsidiaIndex', 'link']) {
    const points = Array.from({ length: 1200 }, (_, t) => obsidiaPosition(pattern, 105 + t, [192, 132]));
    expect(Math.min(...points.map((p) => p[0]))).toBeLessThan(130);
    expect(Math.max(...points.map((p) => p[0]))).toBeGreaterThan(254);
    expect(Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1]))).toBeGreaterThan(30);
  }
});

it('次の技の前に中央へ戻り、吹き出し中と再描画では位置を進めない', () => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(2); game.startBoss(false, 0); game.phaseFrame = 400;
  const before = game.bossPosition();
  game.skipPhase();
  expect(game.bossPosition()).toEqual(before);
  expect(game.bossPosition()).toEqual(before);
  for (let frame = 0; frame < 18; frame++) game.update();
  expect(game.phaseFrame).toBe(0);
  expect(game.bossPosition()).toEqual([192, 132]);
  game.update();
  expect(game.phaseFrame).toBe(0);
  expect(game.bossPosition()).toEqual([192, 132]);
});

it('移動した本体から弾が出て、本体位置へのショットが命中する', () => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(2); game.startBoss(false, 1); game.phaseFrame = 196;
  game.update(); // Normalの断捨離は92フレームごとに発射
  const position = game.bossPosition();
  const bullet = game.bullets.objects.find((b) => b.active)!;
  expect(bullet).toBeDefined();
  expect(bullet.x - bullet.vx).toBeCloseTo(position[0]);
  expect(bullet.y - bullet.vy).toBeCloseTo(position[1]);
  const hp = game.phaseHp;
  Object.assign(game.shots.acquire()!, { x: position[0], y: position[1], vx: 0, vy: 0, radius: 3, damage: 10, homing: false });
  game.update();
  expect(game.phaseHp).toBe(hp - 10);
});

it('吹き出しのない技切替は従来どおり宣言中に直前の位置から中央へ戻る', () => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(2); game.startBoss(false, 1); game.phaseFrame = 400;
  const before = game.bossPosition(); game.skipPhase();
  expect(game.phaseIntro).toBeUndefined(); expect(game.bossPosition()).toEqual(before);
  game.phaseFrame = 90; expect(game.bossPosition()).toEqual([192, 77]);
});
