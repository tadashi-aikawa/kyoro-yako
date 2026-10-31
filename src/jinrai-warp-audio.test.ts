import { afterEach, expect, it, vi } from 'vitest';
import { AudioBank } from './audio';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixture() {
  const buffer = { duration: 1.790726 } as AudioBuffer;
  const sources: { buffer?: AudioBuffer; onended?: () => void; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  const context = {
    state: 'running', currentTime: 0, destination: {},
    decodeAudioData: vi.fn(async () => buffer),
    createGain: vi.fn(() => ({ gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() })),
    createBufferSource: vi.fn(() => {
      const source = { buffer: undefined as AudioBuffer | undefined, onended: undefined as (() => void) | undefined, start: vi.fn(), stop: vi.fn(), connect: vi.fn(node => node), disconnect: vi.fn() };
      source.stop.mockImplementation(() => source.onended?.()); sources.push(source); return source;
    }),
  };
  vi.stubGlobal('AudioContext', class {
    constructor() {
      Object.assign(this, context);
      Object.defineProperty(this, 'currentTime', { get: () => context.currentTime });
    }
  });
  const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
  vi.stubGlobal('fetch', fetch);
  return { bank: new AudioBank(), context, buffer, sources, fetch };
}

it('4面の先読み要求は音声解除を待ち、同時要求と再生で音源を重複取得しない', async () => {
  const { bank, context, buffer, sources, fetch } = fixture();
  bank.prepareJinraiWarp(); bank.prepareJinraiWarp(); expect(fetch).not.toHaveBeenCalled();
  bank.unlock(); bank.prepareJinraiWarp();
  await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce());
  expect(fetch).toHaveBeenCalledOnce(); expect(fetch.mock.calls[0]).toEqual(['/assets/audio/jinrai-warp.mp3']);
  bank.play('jinraiWarp'); expect(sources).toHaveLength(1);
  expect(sources[0].buffer).toBe(buffer); expect(sources[0].start).toHaveBeenCalledWith(0, 0.08, 1);
  expect(context.createGain.mock.results[0].value.gain.value).toBe(0.5);
  bank.stopEnergy(); expect(sources[0].stop).toHaveBeenCalledOnce();
  bank.play('jinraiWarp'); expect(sources).toHaveLength(2);
  bank.prepareJinraiWarp(); expect(fetch).toHaveBeenCalledOnce();
  bank.volume = 0; context.currentTime = 2; bank.play('jinraiWarp'); expect(sources).toHaveLength(2);
});

it('遅い読込中の瞬間移動は予約せず、停止後にデコードが終わっても勝手に鳴らない', async () => {
  const { bank, context, buffer, sources } = fixture();
  let finish!: (buffer: AudioBuffer) => void;
  context.decodeAudioData.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  bank.prepareJinraiWarp(); bank.unlock();
  await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce());
  bank.play('jinraiWarp'); bank.stopEnergy(); expect(sources).toHaveLength(0);
  finish(buffer); await Promise.resolve(); await Promise.resolve();
  expect(sources).toHaveLength(0);
  context.currentTime = 1; bank.play('jinraiWarp'); expect(sources).toHaveLength(1);
});

it('音源取得に失敗しても進行を止めず、次の先読みで再取得できる', async () => {
  const { bank, context, fetch, sources } = fixture();
  fetch.mockResolvedValueOnce(new Response(null, { status: 404 }));
  bank.prepareJinraiWarp(); bank.unlock();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(context.decodeAudioData).not.toHaveBeenCalled();
  bank.prepareJinraiWarp();
  await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce());
  bank.play('jinraiWarp'); expect(sources).toHaveLength(1); expect(fetch).toHaveBeenCalledTimes(2);
});
