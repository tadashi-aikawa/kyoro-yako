import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { GameMedia, stageMedia } from './game-media';
import { MediaAssets } from './media-assets';

class Video extends EventTarget {
  src = ''; muted = true; volume = 1; playsInline = true; preload = ''; readyState = 2; currentTime = 0; ended = false; error = null;
  play() { return Promise.resolve(); }
  pause() {}
  removeAttribute() { this.src = ''; }
  load() {}
}
const startSource = vi.fn();
const stopSource = vi.fn();
class Context {
  state = 'running'; currentTime = 0; destination = {};
  resume() { return Promise.resolve(); }
  createGain() { return { gain: { value: 1, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect: (target: unknown) => target, disconnect() {} }; }
  createBufferSource() { return { buffer: null, onended: null, connect: (target: unknown) => target, start: startSource, stop: stopSource, disconnect() {} }; }
  async decodeAudioData() { return { length: 480, duration: 1, numberOfChannels: 2, sampleRate: 480, getChannelData: () => new Float32Array(480).fill(0.2) }; }
}
const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault(): void }) => void> = {};
function press(game: Game, code: string): void {
  listeners.keydown({ code, repeat: false, preventDefault() {} }); game.update(); listeners.keyup({ code, repeat: false, preventDefault() {} });
}
function make(fetcher: typeof fetch): { game: Game; media: GameMedia } {
  const media = new GameMedia(new MediaAssets(fetcher)); const game = new Game(true, media); game.audio.volume = 0;
  return { game, media };
}
beforeEach(() => {
  vi.useFakeTimers();
  startSource.mockClear(); stopSource.mockClear();
  vi.stubGlobal('location', { search: '?stage=1&invincible=1' });
  vi.stubGlobal('window', { addEventListener(kind: string, callback: typeof listeners[string]) { listeners[kind] = callback; } });
  vi.stubGlobal('Image', class { src = ''; });
  vi.stubGlobal('document', { createElement: () => new Video() });
  vi.stubGlobal('AudioContext', Context);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const response = () => new Response(new Uint8Array([1, 2, 3]));

it('必要素材が届くまで戦闘時計を進めず、完了後に再開する', async () => {
  let deliver!: () => void;
  const held = new Promise<Response>(resolve => { deliver = () => resolve(response()); });
  const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).includes('stage-gate') ? held : response());
  const { game, media } = make(fetcher);
  const before = game.debugState;
  for (let i = 0; i < 120; i++) game.update();
  expect(media.loading).toBe(true); expect(game.stageIntroFrame).toBe(before.stageIntroFrame); expect(game.frame).toBe(0);
  deliver(); await vi.waitFor(() => expect(media.loading).toBe(false));
  game.update(); expect(game.frame).toBe(1); expect(game.stageIntroFrame).toBe(1);
});

it('有限回の再試行後は選択を待ち、読み込み直すと再開する', async () => {
  let online = false;
  const fetcher = vi.fn(async () => online ? response() : new Response(null, { status: 503 }));
  const { game, media } = make(fetcher);
  await vi.waitFor(() => expect(media.failed).toBe(true));
  expect(fetcher).toHaveBeenCalledTimes(6); // 必要な2曲に各3回。
  const before = game.frame; for (let i = 0; i < 60; i++) game.update(); expect(game.frame).toBe(before);
  online = true; press(game, 'KeyZ');
  await vi.waitFor(() => expect(media.loading).toBe(false));
  game.update(); expect(game.scene).toBe('stage'); expect(game.frame).toBeGreaterThan(before);
});

it('省略は失敗した素材だけに適用し、プレイヤーの決定前には進めない', async () => {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).includes('stage-gate') ? new Response(null, { status: 404 }) : response());
  const { game, media } = make(fetcher);
  await vi.waitFor(() => expect(media.failed).toBe(true));
  expect(media.assets.isSkipped('bgm:stage-gate')).toBe(false);
  press(game, 'ArrowDown'); press(game, 'KeyZ');
  await vi.waitFor(() => expect(media.loading).toBe(false));
  expect(media.assets.isSkipped('bgm:stage-gate')).toBe(true); expect(media.assets.isSkipped('bgm:boss-neo')).toBe(false);
  game.update(); expect(game.bgm.cue).toBeNull();
});

it('待機中のEscでタイトルへ戻り、遅い応答で元の面へ戻らない', async () => {
  let deliver!: () => void;
  const held = new Promise<Response>(resolve => { deliver = () => resolve(response()); });
  const { game, media } = make(vi.fn(async (input: RequestInfo | URL) => String(input).includes('stage-gate') ? held : response()));
  press(game, 'Escape'); expect(game.scene).toBe('title'); expect(media.loading).toBe(false);
  deliver(); await vi.advanceTimersByTimeAsync(0);
  expect(game.scene).toBe('title'); expect(media.stage).toBeUndefined();
});

it('次面の先読みはその先の面を取得せず、展開済みの曲を増やさない', async () => {
  const fetcher = vi.fn(async (_input: RequestInfo | URL) => response()); const { game, media } = make(fetcher);
  await vi.waitFor(() => expect(media.loading).toBe(false));
  await vi.waitFor(() => expect(media.assets.has('bgm:boss-obsidia')).toBe(true));
  const paths = fetcher.mock.calls.map(([input]) => String(input));
  expect(paths.some(path => path.includes('stage-top'))).toBe(false);
  expect(game.bgm.diagnostics.tracks).toBe(0);
});

it('ボスからのリトライは現面の圧縮データを使い、道中曲を準備し直す', async () => {
  let online = true; const fetcher = vi.fn(async (_input: RequestInfo | URL) => online ? response() : new Response(null, { status: 503 }));
  const { game, media } = make(fetcher); press(game, 'Shift');
  await vi.waitFor(() => expect(media.loading).toBe(false)); game.update();
  game.startBoss(false, 0); game.update(); await vi.waitFor(() => expect(media.loading).toBe(false)); game.update();
  expect(game.bgm.cue).toBe('boss-neo'); online = false;
  const stageRequests = fetcher.mock.calls.filter(([input]) => /stage-gate|boss-neo/.test(String(input))).length;
  game.startStage(1); await vi.waitFor(() => expect(media.loading).toBe(false)); game.update();
  expect(game.bgm.cue).toBe('stage-gate'); expect(media.failed).toBe(false);
  expect(fetcher.mock.calls.filter(([input]) => /stage-gate|boss-neo/.test(String(input))).length).toBe(stageRequests);
  expect(game.bgm.diagnostics.tracks).toBeLessThanOrEqual(2);
});

it('面を繰り返しても、圧縮データは現在面と次面、展開済み曲は2曲まで', async () => {
  const { game, media } = make(vi.fn(async () => response())); press(game, 'Shift');
  for (const stage of [1, 2, 3, 4, 5, 1, 2, 3, 4, 5]) {
    game.startStage(stage);
    await vi.advanceTimersByTimeAsync(1200);
    await vi.waitFor(() => expect(media.loading).toBe(false), { timeout: 3000 }); game.update();
    await vi.advanceTimersByTimeAsync(1200);
    expect(game.bgm.diagnostics.tracks).toBeLessThanOrEqual(2);
    expect(media.assets.diagnostics.files).toBeLessThanOrEqual(stageMedia(stage).length + stageMedia(stage + 1).length);
  }
});

it.each(['', '?stage=1&invincible=1'])('準備済みの同じ曲でも、最初のキー入力後に実際の再生を開始する: %s', async search => {
  vi.stubGlobal('location', { search });
  const { game, media } = make(vi.fn(async () => response()));
  await vi.waitFor(() => expect(media.loading).toBe(false));
  expect(startSource).not.toHaveBeenCalled();
  press(game, 'Shift');
  await vi.waitFor(() => expect(game.bgm.diagnostics.decoding).toBe(0));
  await vi.waitFor(() => expect(game.bgm.diagnostics.tracks).toBeGreaterThan(0));
  await vi.waitFor(() => expect(media.loading).toBe(false)); game.update();
  expect(startSource).toHaveBeenCalled();
  const count = startSource.mock.calls.length; game.update(); expect(startSource).toHaveBeenCalledTimes(count);
});

it('タイトル曲の取得に失敗しても旧曲は停止し、メニュー操作を妨げない', async () => {
  let online = true;
  const { game, media } = make(vi.fn(async () => online ? response() : new Response(null, { status: 503 })));
  press(game, 'Shift'); await vi.waitFor(() => expect(media.loading).toBe(false)); game.update();
  expect(startSource).toHaveBeenCalled(); online = false; stopSource.mockClear();
  press(game, 'Escape'); game.menu = 1; press(game, 'KeyZ');
  await vi.advanceTimersByTimeAsync(1200); game.update();
  expect(game.scene).toBe('title'); expect(media.loading).toBe(false); expect(game.bgm.cue).toBeNull(); expect(stopSource).toHaveBeenCalled();
  press(game, 'ArrowDown'); expect(game.menu).toBe(1);
});

it('ボス登場では2曲の準備が済んでおり、全画面の読み込み待ちへ入らない', async () => {
  const { game, media } = make(vi.fn(async () => response()));
  press(game, 'Shift'); await vi.waitFor(() => expect(media.loading).toBe(false)); game.update();
  expect(game.bgm.diagnostics.tracks).toBe(2);
  game.startBoss(false, 0); game.update();
  expect(game.bgm.cue).toBe('boss-neo'); expect(media.loading).toBe(false);
});

it('サブメニューからタイトルへ戻っても、タイトル曲を頭から再生し直さない', async () => {
  vi.stubGlobal('location', { search: '' });
  const { game } = make(vi.fn(async () => response())); press(game, 'Shift');
  await vi.waitFor(() => expect(game.bgm.diagnostics.tracks).toBe(1)); game.update();
  const count = startSource.mock.calls.length; expect(count).toBeGreaterThan(0);
  for (const menu of [0, 1, 2, 3, 4]) {
    game.menu = menu; press(game, 'KeyZ'); press(game, 'Escape');
    expect(game.scene).toBe('title'); expect(startSource).toHaveBeenCalledTimes(count);
  }
});
