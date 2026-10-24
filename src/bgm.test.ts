import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BgmPlayer, detectLoopRange } from './bgm';
import { Game } from './game';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => vi.unstubAllGlobals());

function sampleBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  return {
    length: channels[0].length,
    duration: channels[0].length / sampleRate,
    sampleRate,
    numberOfChannels: channels.length,
    getChannelData: (index: number) => channels[index],
  } as AudioBuffer;
}

it('先頭と末尾の長い無音だけをループ区間から除く', () => {
  const samples = new Float32Array(2000).fill(0.08);
  samples.fill(0.002, 0, 400);
  samples.fill(0.002, 1500);
  const range = detectLoopRange(sampleBuffer([samples], 1000));
  expect(range.start).toBeCloseTo(0.4);
  expect(range.end).toBeCloseTo(1.5);
});

it('0.3秒未満の静音と片チャンネルだけの静音は残す', () => {
  const left = new Float32Array(2000).fill(0.08);
  const right = new Float32Array(2000).fill(0.08);
  left.fill(0, 0, 200); right.fill(0, 0, 200);
  left.fill(0, 1500); right.fill(0.08, 1500);
  expect(detectLoopRange(sampleBuffer([left, right], 1000))).toEqual({ start: 0, end: 2 });
});

it('曲全体が無音でも有効な区間を返す', () => {
  expect(detectLoopRange(sampleBuffer([new Float32Array(1000)], 1000))).toEqual({ start: 0, end: 1 });
});

it('末尾の無音が短い音で分かれていてもまとめて除く', () => {
  const samples = new Float32Array(3000).fill(0.08);
  samples.fill(0, 1100, 1800);
  samples.fill(0, 1820, 1830);
  samples.fill(0, 1870, 1890);
  samples.fill(0, 1950);
  expect(detectLoopRange(sampleBuffer([samples], 1000))).toEqual({ start: 0, end: 1.1 });
});

it('音量の小さい演奏を無音と誤判定しない', () => {
  const samples = new Float32Array(2000).fill(0.08);
  samples.fill(0, 1200);
  for (let frame = 1200; frame < 1700; frame += 5) samples[frame] = 0.012;
  expect(detectLoopRange(sampleBuffer([samples], 1000))).toEqual({ start: 0, end: 1.7 });
});

it('場面に合わせて道中・中ボス・ボス会話・終幕の曲を選ぶ', () => {
  const game = new Game();
  game.audio.volume = 0;
  expect(game.bgm.cue).toBe('title');
  game.startStage(4); game.update();
  expect(game.bgm.cue).toBe('stage-sakura');
  game.startBoss(true, 0); game.update();
  expect(game.bgm.cue).toBe('stage-sakura');
  game.scene = 'dialogue'; game.afterDialogue = 'boss'; game.update();
  expect(game.bgm.cue).toBe('boss-jinrai');
  game.startBoss(false, 0); game.update();
  expect(game.bgm.cue).toBe('boss-jinrai');
  game.scene = 'dialogue'; game.afterDialogue = 'clear'; game.update();
  expect(game.bgm.cue).toBe('boss-jinrai');
  game.scene = 'clear'; game.update();
  expect(game.bgm.cue).toBeNull();
  game.scene = 'ending'; game.update();
  expect(game.bgm.cue).toBe('ending');
  game.scene = 'pause'; game.update();
  expect(game.bgm.cue).toBe('ending');
  game.scene = 'gameover'; game.update();
  expect(game.bgm.cue).toBe('ending');
});

it('未配置の曲は一度だけ取得を試み、無音で進める', async () => {
  const fetchMock = vi.fn(async () => ({ ok: false }));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('AudioContext', class {
    state = 'running';
    destination = {};
    createGain() { return { gain: { value: 0 }, connect: () => {} }; }
  });
  const bgm = new BgmPlayer(false, 60);
  bgm.sync('title', false);
  bgm.unlock();
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  bgm.sync('stage-gate', false);
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  bgm.sync('title', false);
  await Promise.resolve();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('曲末と曲頭を2秒重ねてループする', async () => {
  vi.useFakeTimers();
  try {
    const starts: Array<[number, number, number]> = [];
    const samples = new Float32Array(14_000).fill(0.2);
    samples.fill(0, 0, 1000);
    samples.fill(0, 12_000);
    const decoded = sampleBuffer([samples], 1000);
    const gain = () => ({
      gain: { value: 1, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, cancelScheduledValues: () => {} },
      connect: (destination: unknown) => destination,
      disconnect: () => {},
    });
    const context = {
      state: 'running', currentTime: 0, destination: {},
      createGain: gain,
      createBufferSource: () => ({
        buffer: null, onended: null,
        connect: (destination: unknown) => destination,
        start: (when: number, offset: number, duration: number) => { starts.push([when, offset, duration]); },
        stop: () => {}, disconnect: () => {},
      }),
      decodeAudioData: async () => decoded,
    };
    vi.stubGlobal('AudioContext', class {
      state = context.state;
      destination = context.destination;
      get currentTime() { return context.currentTime; }
      createGain = context.createGain;
      createBufferSource = context.createBufferSource;
      decodeAudioData = context.decodeAudioData;
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })));
    const bgm = new BgmPlayer(false, 60);
    bgm.sync('title', false);
    bgm.unlock();
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(starts).toEqual([[0.02, 1, 11]]);
    context.currentTime = 5;
    await vi.advanceTimersByTimeAsync(500);
    expect(starts[1][0]).toBeCloseTo(9.02);
    expect(starts[1].slice(1)).toEqual([1, 11]);
    bgm.sync(null, false);
    await vi.advanceTimersByTimeAsync(1100);
  } finally {
    vi.useRealTimers();
  }
});

it('演出倍率とポーズ倍率を独立に掛け、道中曲を再開せず下げた音量からボス曲へ1秒でつなぐ', async () => {
  vi.useFakeTimers();
  try {
    const gains: Array<{ value: number; setValueAtTime: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn>; cancelScheduledValues: ReturnType<typeof vi.fn> }> = [];
    const fetchMock = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('AudioContext', class {
      state = 'running'; currentTime = 10; destination = {};
      createGain() {
        const gain = {
          value: 1,
          setValueAtTime: vi.fn((value: number) => { gain.value = value; }),
          linearRampToValueAtTime: vi.fn((value: number) => { gain.value = value; }),
          cancelScheduledValues: vi.fn(),
        };
        gains.push(gain);
        return { gain, connect: (destination: unknown) => destination, disconnect: () => {} };
      }
      createBufferSource() { return { connect: (destination: unknown) => destination, start: () => {}, stop: () => {}, disconnect: () => {} }; }
      async decodeAudioData() { return sampleBuffer([new Float32Array(10_000).fill(0.2)], 1000); }
    });
    const bgm = new BgmPlayer(false, 60);
    bgm.sync('stage-dawn', false); bgm.unlock();
    await vi.advanceTimersByTimeAsync(0);
    const [master, stage] = gains;
    bgm.sync('stage-dawn', false, 0.35);
    expect(stage.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.35, 11);
    expect(bgm.effectiveVolume).toBe(0.21); expect(fetchMock).toHaveBeenCalledOnce();
    bgm.sync('stage-dawn', true, bgm.sceneVolumeMultiplier);
    expect(master.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.21, 10.12);
    expect(bgm.effectiveVolume).toBeCloseTo(0.0735);
    bgm.setVolume(80); expect(bgm.effectiveVolume).toBeCloseTo(0.098);
    bgm.sync('stage-dawn', false, 0.35);
    expect(bgm.effectiveVolume).toBeCloseTo(0.28);
    const gainCount = gains.length;
    bgm.preload('boss-minerva');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(gains).toHaveLength(gainCount);
    expect(bgm.cue).toBe('stage-dawn');
    stage.linearRampToValueAtTime.mockClear();
    bgm.sync('boss-minerva', false);
    // 先読み済みならPromiseの待機を挟まず、同じ呼び出しでクロスフェードを始める。
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(stage.setValueAtTime).toHaveBeenLastCalledWith(0.35, 10);
    expect(stage.linearRampToValueAtTime.mock.calls).toEqual([[0, 11]]);
    expect(gains[gainCount].linearRampToValueAtTime).toHaveBeenLastCalledWith(1, 11);
    bgm.sync(null, false); await vi.advanceTimersByTimeAsync(1100);
  } finally { vi.clearAllTimers(); vi.useRealTimers(); }
});

it.each(['pause', 'gameover'] as const)('%s中も演出倍率を保ち、その上からポーズの減衰を掛ける', (scene) => {
  const game = new Game();
  game.bgm.sync('stage-dawn', false, 0.35);
  game.scene = scene;
  for (let frame = 0; frame < 3; frame++) {
    game.update();
    expect(game.bgm.sceneVolumeMultiplier).toBe(0.35);
    expect(game.bgm.effectiveVolume).toBeCloseTo(0.0735);
  }
});
