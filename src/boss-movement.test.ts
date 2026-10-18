import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { hasBossMovement, patternPosition } from './boss-movement';
import { Game } from './game';
import { MID_PHASE, STAGES } from './stages';

const SPECIAL = new Set(['sweep', 'jinraiClone', 'jinraiDash', 'interview', 'owlDawn']);
beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => vi.unstubAllGlobals());

function start(stage: number, index: number, mid = false): Game {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(stage); game.startBoss(mid, index);
  return game;
}

it('確認済みの2面と専用移動を除く全中ボス・全ボスの技に新しい移動がある', () => {
  for (const [index, stage] of STAGES.entries()) {
    if (index === 1) continue;
    for (const phase of [MID_PHASE[stage.mid], ...stage.phases]) {
      expect(hasBossMovement(phase.pattern), phase.pattern).toBe(!SPECIAL.has(phase.pattern));
    }
  }
});

it('新しい全軌道は画面上部に収まり、周期をまたいでも位置が飛ばない', () => {
  for (const phase of [...Object.values(MID_PHASE), ...STAGES.flatMap((stage) => stage.phases)]) {
    if (!hasBossMovement(phase.pattern)) continue;
    let previous = patternPosition(phase, 0, [280, 150])!;
    const xs: number[] = [], ys: number[] = [], speeds: number[] = [];
    for (let frame = 1; frame <= phase.duration * 60; frame++) {
      const [x, y] = patternPosition(phase, frame, [280, 150])!;
      xs.push(x); ys.push(y); speeds.push(Math.hypot(x - previous[0], y - previous[1]));
      previous = [x, y];
    }
    expect(Math.min(...xs), phase.pattern).toBeGreaterThanOrEqual(90);
    expect(Math.max(...xs), phase.pattern).toBeLessThanOrEqual(294);
    expect(Math.min(...ys), phase.pattern).toBeGreaterThanOrEqual(54);
    expect(Math.max(...ys), phase.pattern).toBeLessThanOrEqual(172);
    expect(Math.max(...speeds), phase.pattern).toBeLessThan(4);
    expect(Math.max(...xs) - Math.min(...xs), phase.pattern).toBeGreaterThan(60);
    expect(Math.max(...ys) - Math.min(...ys), phase.pattern).toBeGreaterThan(12);
  }
});

it('移動と停止を各面の中ボスと巡回系の通常攻撃で使い分ける', () => {
  for (const pattern of ['etoile', 'codex', 'jinraiFan', 'neoEncore', 'neoTripleTap', 'minervaStarFan', 'grid']) {
    const phase = Object.values(MID_PHASE).find((p) => p.pattern === pattern)
      ?? STAGES.flatMap((stage) => stage.phases).find((p) => p.pattern === pattern)!;
    let previous = patternPosition(phase, 105, [192, 132])!;
    let stopped = 0, moved = 0;
    for (let frame = 106; frame < 1500; frame++) {
      const point = patternPosition(phase, frame, [192, 132])!;
      if (point[0] === previous[0] && point[1] === previous[1]) stopped++;
      else moved++;
      previous = point;
    }
    expect(stopped, pattern).toBeGreaterThan(200);
    expect(moved, pattern).toBeGreaterThan(200);
  }
});

it('全ボスの新しい技は直前の終了位置から宣言中に移動する', () => {
  for (let stage = 1; stage <= 5; stage++) {
    const game = start(stage, 0);
    for (let index = 0; index < STAGES[stage - 1].phases.length - 1; index++) {
      game.phaseFrame = 777;
      const from = game.bossPosition();
      game.skipPhase();
      const pattern = game.phase!.pattern;
      if (SPECIAL.has(pattern)) continue;
      expect(game.bossPosition(), pattern).toEqual(from);
      const snapshot = game.bossPosition();
      expect(game.bossPosition()).toEqual(snapshot);
      game.update();
      expect(Math.hypot(game.bossXY[0] - from[0], game.bossXY[1] - from[1]), pattern).toBeLessThan(1);
    }
  }
});

it('迅雷はレーザーが生きている間は止まり、次の発射前だけ位置を替える', () => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    const game = start(4, 3); game.difficulty = difficulty;
    let origin: [number, number] = [192, 132];
    let repositioned = false;
    for (let frame = 1; frame <= 1020; frame++) {
      game.update();
      const local = game.phaseFrame - 105;
      if (local < 0) continue;
      if (local % 300 === 0) origin = game.bossPosition();
      if (local % 300 < 260) expect(game.bossPosition()).toEqual(origin);
      if (local % 300 > 260 && game.bossXY[0] !== origin[0]) repositioned = true;
      for (const laser of game.jinraiLasers) {
        expect([laser.x, laser.y]).toEqual(origin);
      }
    }
    expect(repositioned).toBe(true);
  }
});

it('クロディーヌの再演は技の境目で飛ばず、一礼と花の放射中は中央に止まる', () => {
  const game = start(3, 9);
  for (const time of [600, 1200, 1800, 2400, 3000]) {
    game.phaseFrame = 104 + time;
    const before = game.bossPosition();
    game.update();
    expect(Math.hypot(game.bossXY[0] - before[0], game.bossXY[1] - before[1])).toBeLessThan(1);
  }
  for (const frame of [3105, 3195, 3380, 3500]) {
    game.phaseFrame = frame;
    expect(game.bossPosition()).toEqual([192, 132]);
  }
});

it('5面ネオの3回の延長は位置を飛ばさず、移動時計を引き継ぐ', () => {
  const game = start(5, 0, true);
  for (let encore = 1; encore <= 3; encore++) {
    game.phaseFrame = game.phase!.duration * 60 - 1;
    const before = game.bossPosition();
    game.update();
    expect(game.encoreCount).toBe(encore);
    expect(Math.hypot(game.bossXY[0] - before[0], game.bossXY[1] - before[1])).toBeLessThan(4);
    game.update();
    expect(game.bossPosition().every(Number.isFinite)).toBe(true);
  }
});
