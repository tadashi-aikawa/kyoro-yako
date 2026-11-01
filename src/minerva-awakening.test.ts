import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { AWAKENING_LINE, AWAKENING_SPEECH, awakeningAura } from './patterns/minerva-awakening';
import { repriseView } from './patterns/minerva-reprise';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener() {} });
  vi.stubGlobal('Image', class { src = ''; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function begin(power = 5): Game {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(5); game.startBoss(false, 10); game.phaseFrame = 104; game.update(); game.cutin = 0;
  game.phaseFrame = 400;
  for (let cycle = 1; cycle <= 9; cycle++) { game.phaseHp = game.phaseMaxHp * (1 - cycle * 0.075) - 0.000001; game.update(); }
  game.items.clear(); game.power = power; game.lives = 2; game.bombs = 1;
  return game;
}
function until(game: Game, stage: string): void {
  for (let frame = 0; game.minervaReprise?.finale?.stage !== stage && frame < 2400; frame++) game.update();
  expect(game.minervaReprise?.finale?.stage).toBe(stage);
}

it.each([0, 1, 3.05, 4, 4.95, 5])('Power%sでは指定した補給を受け取ってからオーラを1秒でまとい、さらに1秒後に攻撃する', power => {
  const game = begin(power), reprise = game.minervaReprise!;
  const spawn = vi.spyOn(game, 'spawnItem');
  for (let frame = 0; frame < 59; frame++) { game.update(); expect(game.battleComment).toBeUndefined(); }
  game.update(); expect(game.battleComment?.text).toBe(AWAKENING_LINE);
  expect(game.battleCommentFrames).toBe(AWAKENING_SPEECH);
  expect(game.battleCommentDuration).toBe(AWAKENING_SPEECH);
  for (let frame = 0; frame < AWAKENING_SPEECH - 1; frame++) { game.update(); expect(spawn).not.toHaveBeenCalled(); }
  game.update(); expect(game.battleComment).toBeUndefined();
  const kinds = power === 5 ? ['radiant', 'bomb', 'life'] : [...Array(Math.ceil(5 - power)).fill('large'), 'bomb', 'life'];
  expect(spawn.mock.calls.map(([, , kind]) => kind)).toEqual(kinds);
  expect(reprise.finale?.stage).toBe('supply'); expect(awakeningAura(reprise)).toBe(0);
  expect(reprise.finale?.gifts.every(item => item.active && item.auto)).toBe(true);
  until(game, 'aura');
  expect(game.power).toBe(5); expect(game.awakened).toBe(power === 5);
  expect(game.bombs).toBe(2); expect(game.lives).toBe(3);
  expect(reprise.finale?.gifts.every(item => !item.active)).toBe(true);
  expect(awakeningAura(reprise)).toBe(0);
  for (let frame = 1; frame < 60; frame++) { game.update(); expect(awakeningAura(reprise)).toBeCloseTo(frame / 60); expect(repriseView(game).phaseFrame).toBeLessThan(105); }
  game.update(); expect(reprise.finale?.stage).toBe('hold'); expect(awakeningAura(reprise)).toBe(1);
  for (let frame = 0; frame < 59; frame++) { game.update(); expect(reprise.finale?.stage).toBe('hold'); expect(repriseView(game).phaseFrame).toBeLessThan(105); }
  game.update(); expect(reprise.finale).toBeUndefined(); expect(repriseView(game).phaseFrame).toBeGreaterThanOrEqual(105);
  expect(spawn.mock.calls.map(([, , kind]) => kind)).toEqual(kinds);
});

it('補給の受け取りを待ち、HPを次の境界以下にしても演出を飛ばさない', () => {
  const game = begin(); until(game, 'supply');
  const reprise = game.minervaReprise!, gifts = reprise.finale!.gifts;
  // 未受取の1個を残す。ほかのアイテムが消えてもオーラを始めない。
  const remaining = gifts[0];
  for (const item of gifts.slice(1)) { game.px = item.x; game.py = item.y; item.launchFrames = 0; game.update(); }
  remaining.auto = false; remaining.manual = true; remaining.vx = 0; remaining.vy = 0; remaining.launchFrames = 1000;
  game.py = 400; remaining.x = 40; remaining.y = 40;
  game.phaseHp = game.phaseMaxHp * 0.2;
  for (let frame = 0; frame < 10; frame++) { game.update(); expect(game.minervaReprise).toBe(reprise); expect(reprise.finale?.stage).toBe('supply'); expect(awakeningAura(reprise)).toBe(0); }
  remaining.launchFrames = 0; game.px = remaining.x; game.py = remaining.y; game.update();
  until(game, 'aura');
});

it('セリフ中のリトライと別フェーズへの切替はセリフ・補給・オーラを残さない', () => {
  const game = begin(); until(game, 'speech');
  game.startBoss(false, 10); expect(game.minervaReprise).toBeUndefined(); expect(game.battleComment).toBeUndefined();
  const other = begin(); until(other, 'speech');
  other.startBoss(false, 9); expect(other.minervaReprise).toBeUndefined(); expect(other.battleComment).toBeUndefined();
});

it.each([0, 3.05, 5])('下端439pxでPower%sの補給をすべて受け取れ、切替中は射撃しない', power => {
  const game = begin(power); game.py = 439; game.autoshot = true; game.keys.add('KeyZ');
  until(game, 'supply');
  for (let frame = 0; game.minervaReprise?.finale?.stage === 'supply' && frame < 2400; frame++) { game.update(); expect(game.shots.count).toBe(0); }
  expect(game.minervaReprise?.finale?.stage).toBe('aura');
  expect(game.power).toBe(5); expect(game.awakened).toBe(power === 5);
  expect(game.bombs).toBe(2); expect(game.lives).toBe(3);
});
