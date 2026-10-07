import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { SWEEP_CHARGE, SWEEP_MOVE, SWEEP_PERIOD, sweepTarget } from './patterns/obsidia';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => vi.unstubAllGlobals());

function start(difficulty: Game['difficulty'] = 'normal', wave = 0): Game {
  const game = new Game(); game.difficulty = difficulty; game.invincible = true;
  game.startStage(2); game.startBoss(false, 6);
  game.phaseFrame = 104 + wave * SWEEP_PERIOD[['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty)];
  game.audio.volume = 0; game.invulnFrames = 0;
  return game;
}
function until(game: Game, frame: number): void { while (game.phaseFrame < frame) game.update(); }

it('一掃は移動して溜め、3回の全方位発散にSEを同期する', () => {
  const game = start(); const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  game.update(); const origin = [...game.bossXY];
  until(game, 140); expect(game.bossXY).not.toEqual(origin);
  expect(play).not.toHaveBeenCalledWith('sweepCharge');
  game.update(); expect(game.bossXY).toEqual(sweepTarget(0));
  expect(play).toHaveBeenCalledWith('sweepCharge');
  until(game, 218); expect(game.bullets.count).toBe(0);
  expect(game.bossXY).toEqual(sweepTarget(0));
  expect(play).not.toHaveBeenCalledWith('sweepBurst');
  expect(play).not.toHaveBeenCalledWith('enemyShot');
  for (const frame of [219, 231, 243]) {
    until(game, frame);
    expect(play.mock.calls.filter(([sound]) => sound === 'sweepBurst')).toHaveLength((frame - 219) / 12 + 1);
  }
  const ring = game.bullets.objects.filter((b) => b.active);
  expect(ring).toHaveLength(108);
  expect(new Set(ring.map((b) => b.gridRow)).size).toBe(3);
  expect(ring.every((b) => b.color >= 0 && b.color < 4 && b.delay === 0)).toBe(true);
  const octants = new Set(ring.map((b) => Math.floor((Math.atan2(b.vy, b.vx) + Math.PI) * 4 / Math.PI) % 8));
  expect(octants.size).toBe(8);
  expect(play).toHaveBeenCalledWith('enemyShot');
});

it('地点と輪・逆回転の星・楕円の針弾が変わり、曲線も外へ広がる', () => {
  for (let wave = 0; wave < 3; wave++) {
    const game = start('normal', wave); const shot = 219 + wave * SWEEP_PERIOD[1];
    until(game, shot + 12); expect(game.bossXY).toEqual(sweepTarget(wave));
    const ring = game.bullets.objects.filter((b) => b.active);
    expect(ring.every((b) => b.gridColumn === wave)).toBe(true);
    if (wave === 1) {
      expect(ring.every((b) => b.kind === 'star')).toBe(true);
      expect(ring.some((b) => b.sway > 0) && ring.some((b) => b.sway < 0)).toBe(true);
      const b = ring[0]; const velocity = [b.vx, b.vy]; const speed = Math.hypot(b.vx, b.vy);
      const distance = Math.hypot(b.x - game.bossXY[0], b.y - game.bossXY[1]);
      until(game, shot + 50);
      expect([b.vx, b.vy]).not.toEqual(velocity);
      expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(speed, 10);
      expect(Math.hypot(b.x - game.bossXY[0], b.y - game.bossXY[1])).toBeGreaterThan(distance);
    } else expect(new Set(ring.map((b) => b.kind))).toEqual(new Set(wave === 2 ? ['orb', 'needle'] : ['orb']));
  }
});

it('固定位置で待つと被弾するが、放射弾の間を選んで抜けられる', () => {
  const hit = start(); until(hit, 218); const [x, y] = hit.bossXY;
  hit.px = x; hit.py = y + 100; hit.invincible = false; const lives = hit.lives;
  until(hit, 275); expect(hit.lives).toBeLessThan(lives);
  const dodge = start(); until(dodge, 218); const angle = Math.PI / 2 + Math.PI / 24;
  dodge.invincible = false;
  for (let frame = 219; frame <= 330; frame++) {
    const radius = Math.min(230, 150 + (frame - 219) * 2.5);
    dodge.px = x + Math.cos(angle) * radius; dodge.py = y + Math.sin(angle) * radius;
    dodge.update();
  }
  expect(dodge.lives).toBe(lives);
});

it('4難易度で溜めと弾数を調整し、プールを飽和させず終了・再開で消す', () => {
  expect(SWEEP_CHARGE[0]).toBeGreaterThan(SWEEP_CHARGE[3]);
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
    const game = start(difficulty); let maximum = 0;
    for (let i = 0; i < SWEEP_PERIOD[level] * 8; i++) { game.update(); maximum = Math.max(maximum, game.bullets.count); }
    expect(maximum).toBeLessThan(400);
    game.startStage(2); game.startBoss(false, 6); expect(game.bullets.count).toBe(0);
    game.phaseFrame = 104; until(game, 105 + SWEEP_MOVE + SWEEP_CHARGE[level]);
    expect(game.bullets.count).toBe([28, 36, 44, 52][level]);
    game.skipPhase(); expect(game.bullets.count).toBe(0);
  }
});
