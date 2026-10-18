import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { midDialogue } from './dialogue';
import { Game } from './game';
import { ETOKICHI_DAWN_PHASES, midPhases, phaseHp } from './stages';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => vi.unstubAllGlobals());

function start(stage: number, phase: number, difficulty: Game['difficulty'] = 'normal'): Game {
  const game = new Game(); game.audio.volume = 0; game.invincible = true; game.difficulty = difficulty;
  game.startStage(stage); game.startBoss(true, phase);
  return game;
}
const run = (game: Game, frames: number) => { for (let i = 0; i < frames; i++) game.update(); };
const active = (game: Game) => game.bullets.objects.filter((bullet) => bullet.active);

it('1面は2技のまま、5面は体力を増した3技へURLから直行できる', () => {
  expect(midPhases('etokichi', 1)).toHaveLength(2);
  expect(midDialogue('mimiko', 'etokichi', 5)).not.toEqual(midDialogue('mimiko', 'etokichi', 1));
  for (const [index, phase] of ETOKICHI_DAWN_PHASES.entries()) {
    vi.stubGlobal('location', { search: `?boss=5&mid=1&phase=${index}` });
    const game = new Game();
    expect(game.boss).toBe('etokichi'); expect(game.phase).toBe(phase);
    expect(game.remainingSpells).toBe(3 - index);
    expect(phase.hp).toBe(phaseHp(5, 'midboss'));
    expect(phase.hp).toBeGreaterThan(midPhases('etokichi', 1)[0].hp);
  }
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('スターリングの%sは2つの輪を逆回転し、直進へほどける', (difficulty) => {
  const game = start(5, 0, difficulty);
  run(game, 105);
  const rings = active(game);
  expect(new Set(rings.map((bullet) => Math.sign(bullet.spin)))).toEqual(new Set([-1, 1]));
  const bullet = rings[0], velocity = [bullet.vx, bullet.vy];
  game.update(); expect([bullet.vx, bullet.vy]).not.toEqual(velocity);
  run(game, 89); expect(bullet.motion).toBe('normal');
});

it('ノヴァは移動の星跡を溜めてから放ち、頂点で五方向に炸裂する', () => {
  const game = start(5, 1); run(game, 105);
  const trail = active(game)[0];
  const origin = [trail.x, trail.y], velocity = [trail.vx, trail.vy];
  run(game, 59); expect([trail.x, trail.y]).toEqual(origin);
  game.px = 300; game.update();
  expect([trail.x, trail.y]).not.toEqual(origin);
  expect([trail.vx, trail.vy]).toEqual(velocity);
  expect(active(game).filter((bullet) => bullet.delay === 0 && bullet.age === 1)).toHaveLength(25);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('5面フラッシュの%sは光線を太くし、発射間隔を短縮し、星弾を重ねる', (difficulty) => {
  const first = start(1, 1, difficulty), dawn = start(5, 2, difficulty);
  run(first, 105); run(dawn, 105);
  expect(dawn.galaxyFlash!.width).toBeGreaterThan(first.galaxyFlash!.width);
  expect(dawn.galaxyFlash!.warning).toBeLessThan(first.galaxyFlash!.warning);
  expect(active(dawn).length).toBeGreaterThan(active(first).length);
  const angle = dawn.galaxyFlash!.angle;
  dawn.px = 320; run(dawn, 30); expect(dawn.galaxyFlash!.angle).toBe(angle);
  run(dawn, 270); expect(dawn.galaxyFlash!.age).toBe(1);
  expect(first.phase!.pattern).toBe('galaxyFlash');
  dawn.bombFrames = 90; dawn.update(); expect(dawn.galaxyFlash).toBeUndefined(); expect(dawn.bullets.count).toBe(0);
});
