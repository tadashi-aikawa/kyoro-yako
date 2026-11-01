import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { ENDING_IMAGES, GameImages, IMAGE_FILES, stageImages, TITLE_IMAGES } from './game-images';
import { GameMedia } from './game-media';
import { MediaAssets, type MediaKey } from './media-assets';
import { REPRISES } from './patterns/minerva-reprise';

const decode = vi.fn<() => Promise<void>>();
const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault(): void }) => void> = {};
beforeEach(() => {
  vi.useFakeTimers();
  decode.mockReset().mockResolvedValue();
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 32; decode() { return decode(); } });
  vi.stubGlobal('location', { search: '?bgm=0' });
  vi.stubGlobal('window', { addEventListener(kind: string, callback: typeof listeners[string]) { listeners[kind] = callback; } });
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const response = () => new Response(new Uint8Array([1, 2, 3]));
function press(game: Game, code: string): void {
  listeners.keydown({ code, repeat: false, preventDefault() {} }); game.update(); listeners.keyup({ code, repeat: false, preventDefault() {} });
}
function make(fetcher: typeof fetch) {
  const media = new GameMedia(new MediaAssets(fetcher));
  return { media, game: new Game(true, media) };
}

it('宣言した全画像は配置済みで、各面に自機・中ボス・専用カットインが含まれる', () => {
  const placed = Object.keys(import.meta.glob('/public/assets/**/*.webp'));
  for (const file of Object.values(IMAGE_FILES)) expect(placed, file).toContain(`/public/assets/${file}`);
  expect(stageImages(1)).toEqual(expect.arrayContaining(['image:mimiko-sprite', 'image:neo-stand', 'image:etokichi-sprite', 'image:enemy-gate']));
  expect(stageImages(3)).toEqual(expect.arrayContaining(['image:claudine-ultimate', 'image:chappy-stand', 'image:claudine-bloom-closed-sprite']));
  expect(stageImages(4)).toEqual(expect.arrayContaining(['image:jinrai-ultimate', 'image:jinrai-kiss-sprite']));
  expect(stageImages(5)).toEqual(expect.arrayContaining(['image:minerva-ultimate', 'image:minerva-solo-prayer-sprite']));
  for (const { boss } of REPRISES) expect(stageImages(5)).toEqual(expect.arrayContaining([`image:${boss}-face`, `image:${boss}-cast-sprite`]));
});

it('タイトル画像の取得中はメニューを進めず、画像を音声・動画より先に要求する', async () => {
  let deliver!: (response: Response) => void;
  const held = new Promise<Response>(resolve => { deliver = resolve; });
  const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).includes('key-visual') ? held : response());
  const { media, game } = make(fetcher);
  press(game, 'KeyZ');
  expect(game.scene).toBe('title'); expect(game.frame).toBe(0); expect(media.loading).toBe(true);
  expect(fetcher.mock.calls.every(([input]) => String(input).endsWith('.webp'))).toBe(true);
  deliver(response()); await vi.waitFor(() => expect(media.loading).toBe(false));
  press(game, 'KeyZ'); expect(game.scene).toBe('difficulty');
});

it('取得済みでもデコードが終わるまで待ち、進捗を完了扱いにしない', async () => {
  let finish!: () => void;
  decode.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const { media, game } = make(vi.fn(async () => response()));
  await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(TITLE_IMAGES.length));
  expect(media.state!.complete).toBe(TITLE_IMAGES.length - 1);
  press(game, 'KeyZ'); expect(game.scene).toBe('title'); expect(game.frame).toBe(0);
  finish(); await vi.waitFor(() => expect(media.loading).toBe(false));
  expect(media.images.count).toBe(TITLE_IMAGES.length);
});

it('カットイン画像の失敗は省略できず、3回の試行後も時計を止め、再取得で復旧する', async () => {
  vi.stubGlobal('location', { search: '?bgm=0&stage=3&invincible=1' });
  let online = false;
  const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).includes('claudine-bloom.webp') && !online ? new Response(null, { status: 503 }) : response());
  const { media, game } = make(fetcher);
  await vi.waitFor(() => expect(media.failed).toBe(true));
  expect(fetcher.mock.calls.filter(([input]) => String(input).includes('claudine-bloom.webp'))).toHaveLength(3);
  expect(media.failureChoices).toEqual(['retry', 'title']);
  media.skip(); expect(media.failed).toBe(true);
  for (let i = 0; i < 100; i++) game.update();
  expect(game.frame).toBe(0); expect(game.phaseFrame).toBe(0);
  online = true; press(game, 'KeyZ');
  await vi.waitFor(() => expect(media.loading).toBe(false));
  expect(media.images.ready('image:claudine-ultimate')).toBe(true);
  game.update(); expect(game.frame).toBe(1);
});

it('デコード失敗ではBlobと画像を捨て、通信から再試行する', async () => {
  const fetcher = vi.fn(async () => response());
  const assets = new MediaAssets(fetcher); const images = new GameImages(assets);
  const key: MediaKey = 'image:title'; assets.retain([key]);
  await assets.load(key); const original = images.elements.title;
  decode.mockRejectedValueOnce(new Error('broken image'));
  await expect(images.prepare(key)).rejects.toThrow('broken image');
  expect(assets.has(key)).toBe(false); expect(images.ready(key)).toBe(false);
  expect(images.elements.title).not.toBe(original);
  await assets.load(key); await images.prepare(key);
  expect(fetcher).toHaveBeenCalledTimes(2); expect(images.ready(key)).toBe(true);
});

it('デコードが停止しても時間切れで復旧可能な失敗になる', async () => {
  const assets = new MediaAssets(vi.fn(async () => response())); const images = new GameImages(assets, 20);
  assets.retain(['image:title']); await assets.load('image:title');
  decode.mockImplementationOnce(() => new Promise(() => {}));
  const failed = expect(images.prepare('image:title')).rejects.toThrow('Image decode timeout');
  await vi.advanceTimersByTimeAsync(20); await failed;
  expect(assets.has('image:title')).toBe(false); expect(images.count).toBe(0);
});

it('場面を離れると準備中の画像を解放し、遅れて完了しても復活しない', async () => {
  const assets = new MediaAssets(vi.fn(async () => response())); const images = new GameImages(assets);
  assets.retain(['image:title']); await assets.load('image:title');
  let finish!: () => void;
  decode.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const pending = images.prepare('image:title');
  const failed = expect(pending).rejects.toThrow('Image released');
  const old = images.elements.title;
  images.retain([]); assets.retain([]); finish(); await failed;
  expect(old.src).toBe(''); expect(images.count).toBe(0); expect(assets.diagnostics.files).toBe(0);
  expect(images.elements.title).not.toBe(old);
});

it('スタッフロールの画像が失敗している間は時計を進めず、再試行後に再開する', async () => {
  vi.stubGlobal('location', { search: '?bgm=0&credits=1' });
  let online = false;
  const { media, game } = make(vi.fn(async (input: RequestInfo | URL) => String(input).includes('/credits/') && !online ? new Response(null, { status: 404 }) : response()));
  await vi.waitFor(() => expect(media.failed).toBe(true));
  game.update(); expect(game.creditsFrame).toBe(0); expect(media.failureChoices).not.toContain('skip');
  online = true; press(game, 'KeyZ');
  await vi.waitFor(() => expect(media.loading).toBe(false));
  game.update(); expect(game.creditsFrame).toBe(1);
  expect(media.images.count).toBe(ENDING_IMAGES.length);
  expect(media.images.ready('image:minerva-ultimate')).toBe(false);
  expect(media.assets.has('image:minerva-ultimate')).toBe(false);
});

it('後から画像の失敗が加わる間はLoadingを保ち、失敗メニューの選択先を変えない', async () => {
  vi.stubGlobal('location', { search: '?stage=1&invincible=1' });
  let deliver!: (response: Response) => void;
  const held = new Promise<Response>(resolve => { deliver = resolve; });
  const { media, game } = make(vi.fn(async (input: RequestInfo | URL) => String(input).includes('neo-stand.webp') ? held : String(input).includes('stage-gate.mp3') ? new Response(null, { status: 503 }) : response()));
  await vi.waitFor(() => expect(media.state!.failures).toContain('梟楼の門の音楽'));
  expect(media.failed).toBe(false); expect(media.loading).toBe(true);
  press(game, 'ArrowDown'); expect(media.menu).toBe(0); expect(game.scene).toBe('stage');
  deliver(new Response(null, { status: 503 }));
  await vi.waitFor(() => expect(media.failed).toBe(true));
  expect(media.failureChoices).toEqual(['retry', 'title']); expect(media.menu).toBe(0);
  media.menu = 2; press(game, 'KeyZ'); expect(game.scene).toBe('stage');
});

it('通信開始を最大4件に制限し、接続待ちの素材にタイムアウトを掛けない', async () => {
  vi.stubGlobal('location', { search: '?bgm=0&stage=3' });
  let active = 0, maximum = 0;
  const fetcher = vi.fn(async () => {
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 10));
    active--; return response();
  });
  const media = new GameMedia(new MediaAssets(fetcher, 20)); new Game(true, media);
  await vi.advanceTimersByTimeAsync(200);
  expect(maximum).toBe(4); expect(media.loading).toBe(false); expect(media.failed).toBe(false);
  expect(media.images.count).toBe(stageImages(3).length);
});

it('前の面で使った次面用の画像は、圧縮データを残してデコード済みの参照を解放する', async () => {
  vi.stubGlobal('location', { search: '?bgm=0&stage=5' });
  const { media, game } = make(vi.fn(async () => response()));
  await vi.waitFor(() => expect(media.loading).toBe(false));
  expect(media.images.ready('image:claudine-cast-sprite')).toBe(true);
  game.startStage(2); await vi.waitFor(() => expect(media.loading).toBe(false));
  expect(media.images.count).toBe(stageImages(2).length);
  expect(media.images.ready('image:claudine-cast-sprite')).toBe(false);
  expect(media.assets.has('image:claudine-cast-sprite')).toBe(true);
});

it.each(['?bgm=0', '?bgm=0&stage=1', '?bgm=0&stage=5'])('全通信が無応答でも、全ファイルを順番に待ち続けず失敗メニューを出す: %s', async search => {
  vi.stubGlobal('location', { search });
  const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => {
    init!.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  }));
  const media = new GameMedia(new MediaAssets(fetcher, 20)); new Game(true, media);
  await vi.advanceTimersByTimeAsync(60);
  expect(media.failed).toBe(true); expect(media.loading).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(12);
  expect(new Set(fetcher.mock.calls.map(([input]) => String(input))).size).toBe(4);
  await vi.advanceTimersByTimeAsync(500);
  expect(fetcher).toHaveBeenCalledTimes(12);
});
