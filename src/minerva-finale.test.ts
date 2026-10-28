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
  game.skipPhase(); run(game, 98);
  return game;
}
function finishDialogue(game: Game): void {
  for (let i = 0; i < game.lines.length; i++) press(game);
  expect(game.scene).toBe('departure'); expect(game.items.count).toBe(0);
  run(game, 59); expect(game.scene).toBe('departure');
  game.update(); expect(game.scene).toBe('departure');
  while (game.particles.count > 0) game.update();
  run(game, 89); expect(game.scene).toBe('departure');
  game.update();
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

it.each([false, true])('5面撃破後は白→動画→対峙→既存3行→退場→クリアへ進む practice=%s', (practice) => {
  const game = new Game(); game.audio.volume = 0; game.practice = practice;
  game.startStage(5); game.startBoss(false, 10); game.skipPhase();
  expect(game.transition).toBe('boss-defeat-flash'); expect(game.items.count).toBe(0);
  run(game, 8); expect(game.transition).toBe('boss-defeat-in'); expect(game.whiteAlpha).toBe(0);
  run(game, 45); expect(game.whiteAlpha).toBe(0.5);
  expect(video().play).not.toHaveBeenCalled();
  expect(game.bgm.cue).toBe('boss-minerva');
  run(game, 45); expect(game.debugState).toMatchObject({ scene: 'movie', movie: 'minerva-finale', bgm: 'boss-minerva', bgmMultiplier: 0.35 });
  expect(video().muted).toBe(true); expect(game.whiteAlpha).toBe(1);
  video().currentTime = 0.75; expect(game.whiteAlpha).toBeCloseTo(0.5);
  video().currentTime = 5; expect(game.whiteAlpha).toBe(0);
  video().currentTime = 10; expect(game.whiteAlpha).toBe(0);
  video().emit('ended'); expect(game.transition).toBe('minerva-finale-out');
  run(game, 75); expect(game.whiteAlpha).toBe(0.5);
  run(game, 75); expect(game.transition).toBe('boss-defeat-hold'); expect(game.whiteAlpha).toBe(1);
  run(game, 60); expect(game.scene).toBe('arrival'); expect(game.bossXY).toEqual([192, 77]);
  expect(game.bgm.sceneVolumeMultiplier).toBe(1);
  press(game); expect(game.lineIndex).toBe(0); run(game, 59); expect(game.whiteAlpha).toBe(0.5);
  run(game, 60); expect(game.scene).toBe('dialogue');
  expect(game.bgm.cue).toBe('boss-minerva'); expect(game.afterDialogue).toBe('clear');
  expect(game.lines).toEqual([
    { who: 'minerva', text: '……私の負けね。招待してよかったわ。' },
    { who: 'mimiko', text: '名前を書かなかったのは、わざとなの？' },
    { who: 'minerva', text: 'ええ。誰が待っているか、会ってからのお楽しみにしたかったのよ。' },
    { who: 'mimiko', text: '……最後まで、楽しませてもらったの。' },
  ]);
  expect(game.whiteAlpha).toBe(0);
  finishDialogue(game);
});

it.each(['KeyZ', 'KeyX'])('最終フェーズ直行からの動画も%sではスキップせず、終了後に会話へ進む', async (key) => {
  const game = defeat(); await vi.advanceTimersByTimeAsync(0);
  video().currentTime = 5; press(game, key);
  expect(game.scene).toBe('movie'); video().emit('ended');
  expect(game.transition).toBe('minerva-finale-out'); expect(game.movies.current).toBe(video());
  expect(video().pause).toHaveBeenCalled(); expect(game.bgm.cue).toBe('boss-minerva');
  run(game, 75); expect(game.whiteAlpha).toBe(0.5);
  run(game, 75); expect(game.transition).toBe('boss-defeat-hold'); expect(game.whiteAlpha).toBe(1);
  expect(game.movies.current).toBeUndefined(); run(game, 60 + 120); finishDialogue(game);
});

it.each(['missing', 'decode', 'timeout', 'rejected'] as const)('動画の%sでも白から対峙・会話・退場・クリアへ進む', async (failure) => {
  const game = new Game(); game.audio.volume = 0; game.startStage(5); game.startBoss(false, 999); game.skipPhase();
  if (failure === 'missing') { video().error = {}; video().emit('error'); }
  if (failure === 'timeout') video().readyState = 0;
  if (failure === 'rejected') video().play.mockRejectedValueOnce(new Error('decode failed'));
  run(game, 98);
  if (failure === 'decode') video().emit('error');
  await vi.advanceTimersByTimeAsync(1000);
  expect(game.transition).toBe('minerva-finale-out');
  run(game, 150); expect(game.whiteAlpha).toBe(1);
  run(game, 60 + 120); expect(game.scene).toBe('dialogue');
  expect(game.bgm.cue).toBe('boss-minerva'); finishDialogue(game);
});

it.each(['ended', 'error'])('?movie=minerva-finaleの%s後は5面撃破後会話・クリアへ進む', async (event) => {
  vi.stubGlobal('location', { search: '?movie=minerva-finale' }); const game = new Game();
  expect(game.stage).toBe(5); expect(game.movieName).toBe('minerva-finale');
  expect(game.bgm.cue).toBe('boss-minerva');
  await vi.advanceTimersByTimeAsync(0);
  video().emit(event);
  run(game, 150 + 60 + 120);
  expect(game.debugState).toMatchObject({ scene: 'dialogue', stage: 5, boss: 'ミネルヴァ', bgm: 'boss-minerva' });
  expect(videos.filter((entry) => entry.play.mock.calls.length > 0)).toHaveLength(1);
  finishDialogue(game);
});

it('5面開始時はlastboss・minerva-finale・endingを先読みする', () => {
  const game = new Game(); game.startStage(5);
  expect(videos.filter((entry) => !entry.src.endsWith('/opening.mp4')).map((entry) => entry.src.split('/').at(-1))).toEqual([
    'lastboss.mp4', 'minerva-finale.mp4', 'ending.mp4',
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
  run(game, 98); expect(game.movieName).toBe('minerva-finale');
  video().emit('ended'); run(game, 150 + 60 + 120); finishDialogue(game);
});
