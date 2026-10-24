import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { MOVIE_SETTINGS, MOVIES, MoviePlayer } from './movies';

class Video extends EventTarget {
  src = '';
  muted = false;
  volume = 1;
  playsInline = false;
  preload = '';
  readyState = 2;
  currentTime = 0;
  error: object | null = null;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  emit(event: string): void { this.dispatchEvent(new Event(event)); }
}
const videos: Video[] = [];
const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void> = {};
const run = (game: Game, frames: number) => { for (let i = 0; i < frames; i++) game.update(); };
const video = (name: string) => videos.find((entry) => entry.src.endsWith(`/${name}.mp4`))!;
function press(game: Game, code = 'KeyZ'): void {
  listeners.keydown({ code, repeat: false, preventDefault: () => {} });
  game.update();
  listeners.keyup({ code, repeat: false, preventDefault: () => {} });
}
beforeEach(() => {
  vi.useFakeTimers();
  videos.length = 0;
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof listeners[string]) => { listeners[kind] = listener; } });
  vi.stubGlobal('Image', class { src = ''; });
  vi.stubGlobal('document', { createElement: () => { const entry = new Video(); videos.push(entry); return entry; } });
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('タイトルでopeningを先読みし、難易度決定後に動画の音を使って再生する', () => {
  const game = new Game();
  expect(videos).toHaveLength(1);
  expect(video('opening')).toMatchObject({ muted: false, volume: 0.6, playsInline: true, preload: 'auto' });
  press(game); game.menu = 3; press(game);
  expect(game.debugState).toMatchObject({ scene: 'movie', movie: 'opening', bgm: null });
  run(game, 20); expect(game.stageFrame).toBe(0);
  press(game, 'Escape'); expect(game.scene).toBe('movie');
  video('opening').emit('ended');
  expect(game.scene).toBe('stage'); expect(game.stageIntroFrame).toBe(0);
  expect(game.bgm.cue).toBe('stage-gate');
  expect(game.difficulty).toBe('lunatic');
});

it.each(MOVIES)('%sの音の設定とBGM音量を動画へ反映する', (name) => {
  const player = new MoviePlayer(); player.setVolume(30); player.preload([name]);
  expect(video(name).muted).toBe(!MOVIE_SETTINGS[name].audio);
  expect(video(name).volume).toBe(0.3);
  player.play(name, () => {}); player.setVolume(0); expect(video(name).volume).toBe(0);
  player.setVolume(120); expect(video(name).volume).toBe(1);
  player.setVolume(-10); expect(video(name).volume).toBe(0);
});

it('OptionのBGM音量を先読み済み・再生中の動画へ反映する', () => {
  const game = new Game(); game.scene = 'option'; game.menu = 1;
  press(game, 'ArrowLeft'); expect(game.optionBgmVolume).toBe(50);
  expect(video('opening').volume).toBe(0.5);
  game.scene = 'difficulty'; press(game);
  expect(game.movies.current?.volume).toBe(0.5); expect(game.bgm.cue).toBeNull();
  game.optionBgmVolume = 20; game.update(); expect(game.movies.current?.volume).toBe(0.2);
  press(game, 'KeyX'); expect(game.bgm.cue).toBe('stage-gate');
});

it('保存済みのBGM音量を動画の再生開始前に反映する', () => {
  vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'owlery-bgm-volume' ? '25' : null });
  vi.stubGlobal('location', { search: '?movie=opening' });
  const game = new Game(); expect(game.movies.current?.volume).toBe(0.25);
});

it('openingを音なし設定に変えると動画をミュートし、道中BGMを使う', () => {
  const original = MOVIE_SETTINGS.opening.audio;
  MOVIE_SETTINGS.opening.audio = false;
  try {
    const game = new Game(); press(game); press(game);
    expect(video('opening').muted).toBe(true); expect(game.bgm.cue).toBe('stage-gate');
  } finally { MOVIE_SETTINGS.opening.audio = original; }
});

it('lastbossを音あり設定に変えるとBGMを止め、会話で再開する', () => {
  const original = MOVIE_SETTINGS.lastboss.audio;
  MOVIE_SETTINGS.lastboss.audio = true;
  try {
    vi.stubGlobal('location', { search: '?movie=lastboss' }); const game = new Game();
    expect(video('lastboss').muted).toBe(false); expect(game.bgm.cue).toBeNull();
    video('lastboss').emit('ended'); expect(game.bgm.cue).toBe('boss-minerva');
  } finally { MOVIE_SETTINGS.lastboss.audio = original; }
});

it.each(['?stage=2', '?boss=3&phase=1', '?stage=5'])('直行%sでopeningを再生しない', (search) => {
  vi.stubGlobal('location', { search });
  const game = new Game();
  expect(game.scene).toBe('stage'); expect(video('opening')).toBeUndefined();
});

it('練習ではopeningを再生しない', () => {
  const game = new Game(); game.menu = 1; press(game); press(game);
  expect(game.practice).toBe(true); expect(game.scene).toBe('stage');
  expect(video('opening').play).not.toHaveBeenCalled();
});

it('5面開始で残り4本を先読みし、道中終了後にlastbossを挟んで会話へ進む', () => {
  const game = new Game(); game.startStage(5);
  expect(videos).toHaveLength(5);
  game.stageIntroFrame = 180; game.stageFrame = 2899; game.midbossElapsedFrames = 6000;
  game.update();
  expect(game.scene).toBe('transition'); run(game, 45);
  expect(game.debugState).toMatchObject({ scene: 'movie', movie: 'lastboss', bgm: 'boss-minerva' });
  expect(game.phase).toBeUndefined();
  video('lastboss').emit('ended');
  expect(game.scene).toBe('arrival'); run(game, 80);
  expect(game.scene).toBe('dialogue'); expect(game.afterDialogue).toBe('boss'); expect(game.boss).toBe('minerva');
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sの5面クリア後、3本を順再生してエンディングへ進む', (difficulty) => {
  const game = new Game(); game.difficulty = difficulty; game.startStage(5); game.scene = 'clear'; press(game);
  for (const name of ['ending-1', 'ending-2', 'ending-3']) {
    expect(game.debugState).toMatchObject({ scene: 'movie', movie: name, bgm: 'ending' });
    video(name).emit('ended');
  }
  expect(game.scene).toBe('ending'); expect(game.endingFrame).toBe(0);
});

it.each(['KeyZ', 'KeyX'])('%sでエンディング動画の残り全部をスキップし、古い終了通知も無視する', (key) => {
  const game = new Game(); game.startStage(5); game.scene = 'clear'; press(game);
  video('ending-1').emit('ended'); press(game, key);
  expect(game.scene).toBe('ending'); expect(game.movies.current).toBeUndefined();
  video('ending-2').emit('ended');
  expect(game.scene).toBe('ending'); expect(video('ending-3').play).not.toHaveBeenCalled();
  expect(video('ending-2').pause).toHaveBeenCalled();
});

it.each(MOVIES)('?movie=%sは指定した1本だけを再生する', (name) => {
  vi.stubGlobal('location', { search: `?movie=${name}` }); const game = new Game();
  expect(game.movieName).toBe(name); video(name).emit('ended');
  expect(game.scene).toBe(name === 'opening' ? 'stage' : name === 'lastboss' ? 'arrival' : 'ending');
  expect(game.movieName).toBeUndefined();
  expect(videos.filter((entry) => entry.play.mock.calls.length > 0)).toHaveLength(1);
});

it('未配置やデコード失敗は即座に次へ進み、同じ素材を再取得しない', () => {
  const player = new MoviePlayer(); const done = vi.fn();
  player.play('opening', done);
  const entry = video('opening'); entry.error = {}; entry.emit('error');
  expect(done).toHaveBeenCalledOnce();
  player.preload(['opening']); player.play('opening', done);
  expect(videos).toHaveLength(1); expect(done).toHaveBeenCalledTimes(2);
});

it('全動画が未配置でもエンディングへ進む', () => {
  const game = new Game(); game.startStage(5);
  for (const entry of videos) { entry.error = {}; entry.emit('error'); }
  game.scene = 'clear'; press(game);
  expect(game.scene).toBe('ending');
});

it('読み込み待ちは1秒で切り上げ、遅れてcanplayが来ても再生しない', () => {
  const player = new MoviePlayer(); player.preload(['opening']); video('opening').readyState = 0;
  const done = vi.fn(); player.play('opening', done);
  vi.advanceTimersByTime(999); expect(done).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1); expect(done).toHaveBeenCalledOnce();
  video('opening').emit('canplay'); expect(video('opening').play).not.toHaveBeenCalled();
});

it('autoplay制限以外のplay失敗では直ちに次の場面へ進む', async () => {
  const game = new Game(); video('opening').play.mockRejectedValue(new Error('decode failed'));
  press(game); press(game); await Promise.resolve(); await Promise.resolve();
  expect(game.scene).toBe('stage'); expect(game.movieName).toBeUndefined();
});

it('音あり動画のNotAllowedErrorは無音で1度だけ再試行し、BGMを流す', async () => {
  const game = new Game();
  video('opening').play.mockRejectedValueOnce(new DOMException('autoplay blocked', 'NotAllowedError'));
  press(game); press(game); expect(game.bgm.cue).toBeNull();
  await vi.advanceTimersByTimeAsync(0); game.update();
  expect(video('opening').play).toHaveBeenCalledTimes(2);
  expect(video('opening').muted).toBe(true); expect(game.scene).toBe('movie');
  expect(game.bgm.cue).toBe('stage-gate'); expect(game.movies.usesAudio('opening')).toBe(false);
  video('opening').emit('ended'); expect(game.scene).toBe('stage');
});

it.each(['NotAllowedError', 'NotSupportedError'])('無音での再試行も%sなら次の場面へ進む', async (name) => {
  const game = new Game();
  video('opening').play.mockRejectedValueOnce(new DOMException('autoplay blocked', 'NotAllowedError'))
    .mockRejectedValueOnce(new DOMException('retry failed', name));
  press(game); press(game); await vi.advanceTimersByTimeAsync(0);
  expect(video('opening').play).toHaveBeenCalledTimes(2);
  expect(game.scene).toBe('stage'); expect(game.bgm.cue).toBe('stage-gate');
});

it('もともと無音の動画はNotAllowedErrorでも再試行しない', async () => {
  const player = new MoviePlayer(); player.preload(['lastboss']); const done = vi.fn();
  video('lastboss').play.mockRejectedValue(new DOMException('blocked', 'NotAllowedError'));
  player.play('lastboss', done); await vi.advanceTimersByTimeAsync(0);
  expect(video('lastboss').play).toHaveBeenCalledOnce(); expect(done).toHaveBeenCalledOnce();
});

it('playが同期的にNotAllowedErrorを投げても無音で再試行する', async () => {
  const game = new Game();
  video('opening').play.mockImplementationOnce(() => { throw new DOMException('blocked', 'NotAllowedError'); });
  press(game); press(game); await vi.advanceTimersByTimeAsync(0); game.update();
  expect(video('opening').play).toHaveBeenCalledTimes(2);
  expect(game.scene).toBe('movie'); expect(game.bgm.cue).toBe('stage-gate');
});

it('スキップ後に届くNotAllowedErrorでは動画を再開しない', async () => {
  const game = new Game(); let reject!: (error: unknown) => void;
  video('opening').play.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  press(game); press(game); press(game, 'KeyX');
  reject(new DOMException('blocked', 'NotAllowedError')); await vi.advanceTimersByTimeAsync(0);
  expect(video('opening').play).toHaveBeenCalledOnce(); expect(game.scene).toBe('stage');
});

it('無音再試行が保留になっても最初の1秒の上限を超えて待たない', async () => {
  const game = new Game();
  video('opening').play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
    .mockImplementationOnce(() => new Promise(() => {}));
  press(game); press(game); await vi.advanceTimersByTimeAsync(0);
  vi.advanceTimersByTime(999); expect(game.scene).toBe('movie');
  vi.advanceTimersByTime(1); expect(game.scene).toBe('stage');
});

it.each(MOVIES)('?movie=%s&bgm=0は動画の音も無効にする', (name) => {
  vi.stubGlobal('location', { search: `?movie=${name}&bgm=0` }); const game = new Game();
  expect(game.movies.current?.muted).toBe(true); expect(game.movies.usesAudio(name)).toBe(false);
  game.optionBgmVolume = 100; game.update(); expect(game.movies.current?.muted).toBe(true);
});

it('playのPromiseが解決しなくても1秒で次へ進む', () => {
  const game = new Game(); video('opening').play.mockImplementation(() => new Promise(() => {}));
  press(game); press(game); vi.advanceTimersByTime(1000);
  expect(game.scene).toBe('stage');
});

it('再生できている動画はstalled通知後も1秒で切らない', async () => {
  const player = new MoviePlayer(); const done = vi.fn(); player.play('opening', done);
  await Promise.resolve(); video('opening').readyState = 4;
  video('opening').emit('stalled'); vi.advanceTimersByTime(1100);
  expect(done).not.toHaveBeenCalled(); expect(player.current).toBe(video('opening'));
  video('opening').emit('ended'); expect(done).toHaveBeenCalledOnce();
});

it('バッファ待ちのwaitingは1秒で切り上げる', async () => {
  const player = new MoviePlayer(); const done = vi.fn(); player.play('opening', done);
  await Promise.resolve(); video('opening').readyState = 2; video('opening').emit('waiting');
  vi.advanceTimersByTime(999); expect(done).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1); expect(done).toHaveBeenCalledOnce();
});

it('再生途中のエラーでも次の動画へ進む', () => {
  const game = new Game(); game.startStage(5); game.scene = 'clear'; press(game);
  video('ending-1').emit('error'); expect(game.movieName).toBe('ending-2');
});

it('エンディングは72フレームずつ行を送り、Zで全文、次のZでロールへ進む', () => {
  vi.stubGlobal('location', { search: '?ending=mimiko' }); const game = new Game();
  expect(game.endingLines).toHaveLength(6); expect(game.endingLineAlpha(0)).toBe(0);
  run(game, 30); expect(game.endingLineAlpha(0)).toBe(1); expect(game.endingLineAlpha(1)).toBe(0);
  run(game, 57); expect(game.endingLineAlpha(1)).toBe(0.5); expect(game.endingLineAlpha(2)).toBe(0);
  press(game); expect(game.scene).toBe('ending'); expect(game.endingComplete).toBe(true);
  expect(game.endingFrame).toBe(88);
  expect(game.endingLineAlpha(5)).toBe(1); press(game);
  expect(game.scene).toBe('credits'); expect(game.creditsFrame).toBe(0);
});

it('ロールは25秒流れ、約2秒待ってタイトルへ戻る', () => {
  const game = new Game(); game.scene = 'credits'; run(game, 1500);
  expect(game.scene).toBe('credits'); run(game, 119); expect(game.scene).toBe('credits');
  game.update(); expect(game.scene).toBe('title'); expect(game.menu).toBe(0);
});

it('ロールのZは2倍速、Xは終端へ飛ぶ', () => {
  const game = new Game(); game.scene = 'credits'; game.keys.add('KeyZ'); run(game, 100);
  expect(game.creditsFrame).toBe(200); game.keys.delete('KeyZ'); press(game, 'KeyX');
  expect(game.creditsFrame).toBe(1500); run(game, 120); expect(game.scene).toBe('title');
});

it('ロール終了後の2秒はZを押していても短縮しない', () => {
  const game = new Game(); game.scene = 'credits'; game.keys.add('KeyZ'); run(game, 750);
  expect(game.creditsFrame).toBe(1500); run(game, 119); expect(game.scene).toBe('credits');
  game.update(); expect(game.scene).toBe('title');
});

it.each([1, 2, 3, 4, 5])('%s面の暗幕45フレーム中は敵を出さず、道中の時計を止める', (stage) => {
  vi.stubGlobal('location', { search: `?stage=${stage}` }); const game = new Game();
  game.keys.add('ArrowRight'); const x = game.px; run(game, 45);
  expect(game.px).toBeGreaterThan(x); expect(game.stageFrame).toBe(0); expect(game.enemies.count).toBe(0);
  run(game, 20); expect(game.stageFrame).toBe(20); expect(game.enemies.count).toBeGreaterThan(0);
  run(game, 115); expect(game.stageIntroFrame).toBe(180);
});
