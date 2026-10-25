import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';

class Video extends EventTarget {
  src = '';
  muted = false;
  readyState = 4;
  currentTime = 0;
  duration = 10;
  error: object | null = null;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  emit(event: string): void { this.dispatchEvent(new Event(event)); }
}
const videos: Video[] = [];
const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void> = {};
const run = (game: Game, frames: number) => { for (let i = 0; i < frames; i++) game.update(); };
const video = () => videos.find((entry) => entry.src.endsWith('/minerva-finale.mp4'))!;
function press(game: Game, code = 'KeyZ'): void {
  listeners.keydown({ code, repeat: false, preventDefault: () => {} });
  game.update(); listeners.keyup({ code, repeat: false, preventDefault: () => {} });
}
function defeat(): Game {
  vi.stubGlobal('location', { search: '?boss=5&phase=10&invincible=1' });
  const game = new Game(); game.audio.volume = 0;
  game.skipPhase(); run(game, 180);
  return game;
}
function finishDialogue(game: Game): void {
  run(game, 20);
  for (let i = 0; i < game.lines.length; i++) press(game);
  expect(game.scene).toBe('clear'); expect(game.giftFrame).toBe(0);
  expect(game.items.objects.some((item) => item.active && item.gift)).toBe(false);
  expect(game.bgm.cue).toBeNull();
}
beforeEach(() => {
  vi.useFakeTimers(); videos.length = 0;
  vi.spyOn(Math, 'random').mockReturnValue(0.9);
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('Image', class { src = ''; });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof listeners[string]) => { listeners[kind] = listener; } });
  vi.stubGlobal('document', { createElement: () => { const entry = new Video(); videos.push(entry); return entry; } });
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each([false, true])('5面撃破後は回収→黒→動画→既存3行→クリアへ進む practice=%s', (practice) => {
  const game = new Game(); game.audio.volume = 0; game.practice = practice;
  game.startStage(5); game.startBoss(false, 10); game.skipPhase();
  run(game, 179); expect(game.scene).toBe('stage'); expect(video().play).not.toHaveBeenCalled();
  game.update(); expect(game.transition).toBe('minerva-finale-in'); expect(game.blackAlpha).toBe(0);
  run(game, 10); expect(game.blackAlpha).toBe(0.5); expect(game.whiteAlpha).toBe(0);
  expect(game.bgm.cue).toBe('boss-minerva');
  run(game, 10); expect(game.debugState).toMatchObject({ scene: 'movie', movie: 'minerva-finale', bgm: 'boss-minerva' });
  expect(video().muted).toBe(true); expect(game.blackAlpha).toBe(1);
  video().currentTime = 10 / 60; expect(game.blackAlpha).toBeCloseTo(0.5);
  video().currentTime = 5; expect(game.blackAlpha).toBe(0);
  video().currentTime = 10 - 10 / 60; expect(game.blackAlpha).toBeCloseTo(0.5);
  video().emit('ended'); expect(game.scene).toBe('dialogue'); expect(game.blackAlpha).toBe(1);
  expect(game.bgm.cue).toBe('boss-minerva'); expect(game.afterDialogue).toBe('clear');
  expect(game.lines).toEqual([
    { who: 'minerva', text: '完了の印だけで決めつけた説は撤回するわ。約束は、まだこれからだった。' },
    { who: 'mimiko', text: 'ふわっ。「朝、みんなで屋上へ。」今度は、あたしが届けるのね。' },
    { who: 'minerva', text: '私の返事も書いて。もちろん、行くわ。続きは、みんなで。' },
  ]);
  press(game); expect(game.lineIndex).toBe(0); run(game, 9); expect(game.blackAlpha).toBe(0.5);
  run(game, 10); expect(game.blackAlpha).toBe(0);
  finishDialogue(game);
});

it.each(['KeyZ', 'KeyX'])('最終フェーズ直行から動画を%sでスキップできる', async (key) => {
  const game = defeat(); run(game, 20); await vi.advanceTimersByTimeAsync(0);
  video().currentTime = 5; press(game, key);
  expect(game.transition).toBe('minerva-finale-out'); expect(game.movies.current).toBe(video());
  expect(video().pause).toHaveBeenCalled(); expect(game.bgm.cue).toBe('boss-minerva');
  video().emit('ended'); run(game, 10); expect(game.blackAlpha).toBe(0.5);
  run(game, 10); expect(game.scene).toBe('dialogue'); expect(game.blackAlpha).toBe(1);
  expect(game.movies.current).toBeUndefined(); finishDialogue(game);
});

it.each(['missing', 'decode', 'timeout', 'rejected'] as const)('動画の%sでも黒から会話・クリアへ進む', async (failure) => {
  const game = defeat();
  if (failure === 'missing') { video().error = {}; video().emit('error'); }
  if (failure === 'timeout') video().readyState = 0;
  if (failure === 'rejected') video().play.mockRejectedValueOnce(new Error('decode failed'));
  run(game, 20);
  if (failure === 'decode') video().emit('error');
  await vi.advanceTimersByTimeAsync(1000);
  expect(game.scene).toBe('dialogue'); expect(game.blackAlpha).toBe(1);
  expect(game.bgm.cue).toBe('boss-minerva'); finishDialogue(game);
});

it.each(['ended', 'KeyZ', 'KeyX', 'error'])('?movie=minerva-finaleの%s後は5面撃破後会話・クリアへ進む', async (event) => {
  vi.stubGlobal('location', { search: '?movie=minerva-finale' }); const game = new Game();
  expect(game.stage).toBe(5); expect(game.movieName).toBe('minerva-finale');
  expect(game.bgm.cue).toBe('boss-minerva');
  await vi.advanceTimersByTimeAsync(0);
  if (event.startsWith('Key')) { video().currentTime = 5; press(game, event); run(game, 20); }
  else video().emit(event);
  expect(game.debugState).toMatchObject({ scene: 'dialogue', stage: 5, boss: 'ミネルヴァ', bgm: 'boss-minerva' });
  expect(videos.filter((entry) => entry.play.mock.calls.length > 0)).toHaveLength(1);
  finishDialogue(game);
});

it('5面開始時はlastboss・minerva-finale・endingを先読みする', () => {
  const game = new Game(); game.startStage(5);
  expect(videos.filter((entry) => !entry.src.endsWith('/opening.mp4')).map((entry) => entry.src.split('/').at(-1))).toEqual([
    'lastboss.mp4', 'minerva-finale.mp4', 'ending-1.mp4', 'ending-2.mp4', 'ending-3.mp4',
  ]);
  expect(video().play).not.toHaveBeenCalled();
});

it('?stage=5&from=bossから登場・戦闘・撃破後動画・会話・クリアを通せる', () => {
  vi.stubGlobal('location', { search: '?stage=5&from=boss' }); const game = new Game();
  game.invincible = true; game.audio.volume = 0;
  run(game, 120 + 90); expect(game.movieName).toBe('lastboss');
  videos.find((entry) => entry.src.endsWith('/lastboss.mp4'))!.emit('ended');
  run(game, 150 + 60 + 120); expect(game.scene).toBe('dialogue');
  for (let i = 0; i < game.lines.length; i++) press(game);
  while (game.phase) game.skipPhase();
  run(game, 180 + 20); expect(game.movieName).toBe('minerva-finale');
  video().emit('ended'); finishDialogue(game);
});
