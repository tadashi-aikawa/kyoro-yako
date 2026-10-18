import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { THUNDER_LIFE, THUNDER_PERIOD, THUNDER_WARNING } from './patterns/jinrai';

const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void> = {};
beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof listeners[string]) => { listeners[kind] = listener; } });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sの落雷は位置固定の予告・18fの落雷・休止を重ねずに繰り返す', (difficulty) => {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const game = new Game(); game.audio.volume = 0; game.difficulty = difficulty;
  game.startStage(4); game.startBoss(false, 5);
  game.px = 192; game.py = 380; game.phaseFrame = 104;
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  game.update();
  expect(game.jinraiMarks).toHaveLength([2, 3, 4, 5][level]);
  const marks = game.jinraiMarks.map((m) => ({ ...m }));
  game.px = 214;
  for (let i = 1; i < THUNDER_WARNING[level]; i++) game.update();
  expect(game.jinraiMarks.map((m) => [m.x, m.y])).toEqual(marks.map((m) => [m.x, m.y]));
  expect(game.pendingHit).toBe(-1);
  expect(game.bullets.count).toBe(0);
  expect(play.mock.calls.filter(([sound]) => sound === 'thunder')).toHaveLength(1);
  for (let i = 0; i < THUNDER_LIFE; i++) game.update();
  expect(game.jinraiMarks).toHaveLength(0);
  expect(THUNDER_PERIOD[level] - THUNDER_WARNING[level] - THUNDER_LIFE).toBeGreaterThanOrEqual(48);
  for (let i = THUNDER_WARNING[level] + THUNDER_LIFE; i <= THUNDER_PERIOD[level]; i++) game.update();
  expect(game.jinraiMarks.some((m) => m.x === 214)).toBe(true);
});

it('予告中は同じ場所でも無害で、発光した最初のフレームから当たる', () => {
  const game = new Game(); game.audio.volume = 0;
  game.startStage(4); game.startBoss(false, 5); game.phaseFrame = 104; game.invulnFrames = 0;
  game.update();
  for (let i = 1; i < THUNDER_WARNING[1] - 1; i++) game.update();
  expect(game.pendingHit).toBe(-1);
  game.update(); expect(game.pendingHit).toBeGreaterThanOrEqual(0);
});

it.each([9, 375])('壁際x=%sでも自機位置の予告を省かず、線を重ねない', (x) => {
  const game = new Game(); game.audio.volume = 0; game.difficulty = 'lunatic';
  game.startStage(4); game.startBoss(false, 5); game.px = x; game.phaseFrame = 104; game.update();
  const xs = game.jinraiMarks.map((m) => m.x);
  expect(xs).toContain(x); expect(new Set(xs).size).toBe(xs.length);
  expect(xs.every((v) => v >= 9 && v <= 375)).toBe(true);
});

it('ボムで予告を消し、ボム中は落雷を仕込まない', () => {
  const game = new Game(); game.audio.volume = 0;
  game.startStage(4); game.startBoss(false, 5); game.phaseFrame = 104; game.update();
  listeners.keydown({ code: 'KeyX', repeat: false, preventDefault: () => {} }); game.update(); game.keys.delete('KeyX');
  expect(game.jinraiMarks).toHaveLength(0);
  for (let i = 0; i < 149; i++) game.update();
  expect(game.jinraiMarks).toHaveLength(0);
});
