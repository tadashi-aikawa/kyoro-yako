import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { minervaSoloSprite, summonOwl } from './patterns/minerva-summon';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener() {} });
  vi.stubGlobal('Image', class { src = ''; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('最終技は離陸の2秒間と召喚の1秒間を待ってから初弾を撃ち、次回は召喚だけを待つ', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.999);
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(5); game.startBoss(false, 10);
  while (game.phaseFrame < 284) { game.update(); expect(game.bullets.count).toBe(0); }
  game.update(); expect(game.bullets.count).toBeGreaterThan(0);
  game.phaseHp -= game.phaseMaxHp * 0.081; game.update();
  expect(game.minervaReprise?.cycle).toBe(1);
  const nextAttack = game.phaseFrame + 60;
  while (game.phaseFrame < nextAttack - 1) { game.update(); expect(game.bullets.count).toBe(0); }
  game.update(); expect(game.bullets.count).toBeGreaterThan(0);
});

it('フクロウは手元から頭上へゆっくり上昇し、全ポーズの本体がフクロウなしの素材を使う', () => {
  const hand = summonOwl(105, 192, 132), middle = summonOwl(165, 192, 132), above = summonOwl(225, 192, 132);
  expect(hand).toMatchObject({ x: 176, y: 109, progress: 0 });
  expect(middle.y).toBeLessThan(hand.y); expect(middle.y).toBeGreaterThan(above.y);
  expect(above.x).toBe(192); expect(above.progress).toBe(1);
  expect(summonOwl(450, 192, 107).y).toBeGreaterThanOrEqual(43);
  const game = new Game();
  for (const pose of ['idle', 'left', 'right', 'cast', 'prayer'] as const) for (const frame of [0, 22]) {
    const id = minervaSoloSprite(pose, frame);
    expect(id).toMatch(/^minerva-solo-/);
    expect(game.images[`${id}-sprite`].src).toContain(`${id}.webp`);
  }
});
