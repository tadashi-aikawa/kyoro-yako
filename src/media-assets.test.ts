import { afterEach, expect, it, vi } from 'vitest';
import { MediaAssets } from './media-assets';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it('最後のバイトまで届く前は準備済みにせず、同じ素材の取得を共有する', async () => {
  let writer!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(controller) { writer = controller; controller.enqueue(new Uint8Array([1, 2])); } });
  const fetcher = vi.fn(async () => new Response(stream, { headers: { 'Content-Length': '4' } }));
  const assets = new MediaAssets(fetcher); assets.retain(['movie:ending']);
  const first = assets.load('movie:ending'); const second = assets.load('movie:ending');
  expect(first).toBe(second);
  await vi.waitFor(() => expect(assets.diagnostics.bytes).toBe(2));
  expect(assets.has('movie:ending')).toBe(false); expect(assets.objectUrl('movie:ending')).toBeUndefined();
  writer.enqueue(new Uint8Array([3, 4])); writer.close();
  expect((await first).size).toBe(4); expect(assets.has('movie:ending')).toBe(true); expect(fetcher).toHaveBeenCalledOnce();
});

it('次の面で不要になる素材のURLを破棄し、圧縮データも保持しない', async () => {
  const assets = new MediaAssets(vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))));
  assets.retain(['movie:opening']); await assets.load('movie:opening');
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  const url = assets.objectUrl('movie:opening'); expect(assets.objectUrl('movie:opening')).toBe(url);
  assets.retain(['bgm:stage-archive']);
  expect(revoke).toHaveBeenCalledWith(url); expect(assets.diagnostics).toEqual({ files: 0, bytes: 0, downloading: 0 });
});

it('不要になった面の取得を中止し、遅れて返った結果を復活させない', async () => {
  let deliver!: (response: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(resolve => { deliver = resolve; }));
  const assets = new MediaAssets(fetcher); assets.retain(['bgm:stage-gate']);
  const pending = assets.load('bgm:stage-gate');
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  assets.retain(['bgm:stage-archive']); deliver(new Response(new Uint8Array([1])));
  await rejected; expect(assets.has('bgm:stage-gate')).toBe(false);
});

it('一時的な失敗をキャッシュせず再取得できる', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(new Response(new Uint8Array([1])));
  const assets = new MediaAssets(fetcher); assets.retain(['bgm:title']);
  await expect(assets.load('bgm:title')).rejects.toThrow('503');
  await expect(assets.load('bgm:title')).resolves.toMatchObject({ size: 1 }); expect(fetcher).toHaveBeenCalledTimes(2);
});

it('通信が進まないと中止し、待ち続けない', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')));
  }));
  const assets = new MediaAssets(fetcher, 20); assets.retain(['bgm:title']);
  const rejected = expect(assets.load('bgm:title')).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(20); await rejected; expect(assets.diagnostics.files).toBe(0);
});

it('途中で切れたファイルは再生へ渡さない', async () => {
  const assets = new MediaAssets(vi.fn(async () => new Response(new Uint8Array([1]), { headers: { 'Content-Length': '4' } })));
  assets.retain(['movie:ending']); await expect(assets.load('movie:ending')).rejects.toThrow('Incomplete');
  expect(assets.has('movie:ending')).toBe(false);
});

it('省略した素材を次の挑戦で取得し直せる', async () => {
  const fetcher = vi.fn(async () => new Response(new Uint8Array([1])));
  const assets = new MediaAssets(fetcher); assets.retain(['movie:opening']); assets.skip(['movie:opening']);
  expect(assets.has('movie:opening')).toBe(true); expect(assets.objectUrl('movie:opening')).toBeUndefined();
  assets.unskip(['movie:opening']); expect(assets.has('movie:opening')).toBe(false);
  await assets.load('movie:opening'); expect(fetcher).toHaveBeenCalledOnce();
});
