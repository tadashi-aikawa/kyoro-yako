import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { STAGES } from './stages';

const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void> = {};
const run = (game: Game, frames: number) => { for (let i = 0; i < frames; i++) game.update(); };
function press(game: Game, code = 'KeyZ'): void {
  listeners.keydown({ code, repeat: false, preventDefault: () => {} });
  game.update(); listeners.keyup({ code, repeat: false, preventDefault: () => {} });
}
function start(stage: number): Game {
  const game = new Game(); game.audio.volume = 0;
  game.startStage(stage); game.startBoss(false, 999); game.update();
  return game;
}
function conversation(game: Game): void {
  game.skipPhase();
  run(game, 8 + 90 + (game.stage >= 4 ? 150 : 0) + 60 + 120);
  expect(game.scene).toBe('dialogue');
}
function depart(game: Game): void {
  for (let i = 0; i < game.lines.length; i++) press(game);
  expect(game.scene).toBe('departure');
}
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.9);
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('Image', class { src = ''; });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof listeners[string]) => { listeners[kind] = listener; } });
  // 未配置動画の即時縮退。実動画の終了・スキップ・失敗は個別の動画テストで検証する。
  vi.stubGlobal('document', undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([1, 2, 3, 4, 5])('%s面の撃破後98fも背景スクロールと無敵時間の減算を進める', (stage) => {
  const game = start(stage); game.invulnFrames = 120;
  const distance = game.sceneryDistance;
  game.skipPhase(); run(game, 98);
  expect(game.sceneryDistance).toBeCloseTo(distance + 98 * 1.8);
  expect(game.invulnFrames).toBe(22);
  game.startStage(stage); game.startBoss(false, 999); game.invulnFrames = 2;
  game.skipPhase(); run(game, 98); expect(game.invulnFrames).toBe(0);
});

it.each([1, 2, 3, 4, 5])('%s面のボスは撃破位置を保ち、閃光から白へ溶ける98fで定位置へ滑らかに寄る', (stage) => {
  const game = start(stage); game.phaseFrame = 210;
  const origin = game.bossXY;
  const distance = Math.hypot(origin[0] - 192, origin[1] - 77);
  expect(distance).toBeGreaterThan(0);
  game.skipPhase(); expect(game.bossXY).toEqual(origin);
  let previous = origin;
  for (let frame = 1; frame <= 98; frame++) {
    game.update();
    const position = game.bossXY;
    const progress = frame / 98, ease = progress * progress * (3 - 2 * progress);
    expect(position[0]).toBeCloseTo(origin[0] + (192 - origin[0]) * ease);
    expect(position[1]).toBeCloseTo(origin[1] + (77 - origin[1]) * ease);
    expect(Math.hypot(position[0] - previous[0], position[1] - previous[1])).toBeLessThan(distance * 0.02);
    previous = position;
  }
  expect(game.bossXY).toEqual([192, 77]);
});

it.each([1, 2, 3, 4, 5].flatMap((stage) => [
  { stage, transition: 'boss-defeat-flash', elapsed: 0 },
  { stage, transition: 'boss-defeat-in', elapsed: 8 },
  ...(stage >= 4 ? [{ stage, transition: stage === 4 ? 'jinrai-gift-out' : 'minerva-finale-out', elapsed: 98 }] : []),
  { stage, transition: 'boss-defeat-hold', elapsed: stage >= 4 ? 248 : 98 },
]))('$stage面の白演出 $transition でEsc・X・Zを押しても中断・ボム・会話送りしない', ({ stage, transition, elapsed }) => {
  const game = start(stage); game.skipPhase(); run(game, elapsed);
  const bombs = game.bombs;
  expect(game.transition).toBe(transition);
  for (const [index, code] of ['Escape', 'KeyX', 'KeyZ'].entries()) {
    press(game, code);
    expect(game.scene).toBe('transition'); expect(game.transition).toBe(transition);
    expect(game.transitionFrame).toBe(index + 1);
    expect(game.bombs).toBe(bombs); expect(game.bombFrames).toBe(0); expect(game.lineIndex).toBe(0);
  }
});

it.each([1, 2, 3, 4, 5].flatMap((stage) => [false, true].map((practice) => ({ stage, practice }))))('$stage面の最終撃破は8f閃光→90f白→動画縮退→60f保持→120f対峙へ進む practice=$practice', ({ stage, practice }) => {
  const game = start(stage); game.practice = practice; const clock = game.stageFrame;
  game.spawnBullet(30, 30, 0, 0, 0); game.shots.acquire(); game.enemies.acquire();
  game.spawnItem(100, 100, 'small', false);
  game.pendingHit = 7; game.bombFrames = 10;
  const lives = game.lives, bombs = game.bombs;
  const origin = game.bossXY;
  game.skipPhase();
  expect(game.debugState).toMatchObject({ scene: 'transition', transition: 'boss-defeat-flash', transitionFrame: 0, items: 0, bullets: 0, bgmMultiplier: 0.35 });
  expect(game.bgm.cue).toBe(`boss-${STAGES[stage - 1].boss}`);
  expect(game.shots.count).toBe(0); expect(game.enemies.count).toBe(0);
  expect(game.pendingHit).toBe(-1); expect(game.bombFrames).toBe(0);
  expect(game.flash).toBe(8); expect(game.bossXY).toEqual(origin);
  game.autoshot = true; game.keys.add('ArrowRight'); game.keys.add('KeyZ');
  const x = game.px;
  press(game, 'KeyX'); run(game, 6); expect(game.transition).toBe('boss-defeat-flash');
  expect(game.px).toBeGreaterThan(x); expect(game.lives).toBe(lives); expect(game.bombs).toBe(bombs); expect(game.shots.count).toBe(0);
  game.keys.clear(); game.update();
  expect(game.transition).toBe('boss-defeat-in'); expect(game.transitionFrame).toBe(0);
  run(game, 45); expect(game.whiteAlpha).toBe(0.5);
  run(game, 44); expect(game.transition).toBe('boss-defeat-in');
  game.update();
  if (stage >= 4) {
    expect(game.transition).toBe(stage === 4 ? 'jinrai-gift-out' : 'minerva-finale-out');
    expect(game.whiteAlpha).toBe(1);
    run(game, 149); expect(game.transitionFrame).toBe(149); game.update();
  }
  expect(game.transition).toBe('boss-defeat-hold'); expect(game.whiteAlpha).toBe(1);
  run(game, 59); expect(game.transition).toBe('boss-defeat-hold');
  game.update(); expect(game.scene).toBe('arrival'); expect(game.arrivalFrame).toBe(0);
  expect(game.bgm.sceneVolumeMultiplier).toBe(1); expect(game.bossXY).toEqual([192, 77]);
  press(game); expect(game.lineIndex).toBe(0);
  run(game, 59); expect(game.whiteAlpha).toBe(0.5); expect(game.bossXY).toEqual([192, 77]);
  run(game, 59); expect(game.scene).toBe('arrival'); expect(game.whiteAlpha).toBeCloseTo(1 / 120);
  game.update(); expect(game.scene).toBe('dialogue'); expect(game.whiteAlpha).toBe(0);
  expect(game.stageFrame).toBe(clock); expect(game.items.count).toBe(0);
});

it.each([1, 2, 3])('%s面は会話後の退場開始時にlife・bomb・largeだけを自動回収で配り、60fと回収の両方を待つ', (stage) => {
  const game = start(stage); conversation(game);
  game.lives = 2; game.bombs = 1; game.power = 1.5; game.point = 10000; game.graze = 7; game.score = 0;
  depart(game);
  const bonus = stage * 1_000_000 + 710700;
  expect(game.clearBonus).toBe(bonus); expect(game.score).toBe(0);
  const items = game.items.objects.filter((item) => item.active);
  expect(items.map((item) => item.kind)).toEqual(['life', 'bomb', 'large']);
  expect(items.every((item) => item.auto && !item.gift && item.x === 192 && item.y === 77)).toBe(true);
  // 退場後も回収待ちする条件を作り、時間だけでクリアしないことを確かめる。
  for (const item of items) item.launchFrames = 90;
  expect(game.bossXY).toEqual([192, 77]); expect(game.particles.count).toBeGreaterThan(0);
  run(game, 30); expect(game.bossXY).toEqual([192, 61.375]);
  run(game, 30); expect(game.scene).toBe('departure'); expect(game.bossXY).toEqual([192, -48]);
  expect(game.items.count).toBeGreaterThan(0);
  for (let i = 0; i < 600 && game.scene === 'departure'; i++) game.update();
  expect(game.scene).toBe('clear'); expect(game.items.count).toBe(0); expect(game.boss).toBeUndefined();
  expect(game.lives).toBe(3); expect(game.bombs).toBe(2); expect(game.power).toBe(2.5);
  expect(game.clearBonus).toBe(bonus); expect(game.score).toBe(bonus);
});

it.each([1, 2, 3])('%s面で報酬がすべて回収・消失しても退場60fは省略しない', (stage) => {
  const game = start(stage); conversation(game); depart(game);
  game.items.objects.filter((item) => item.active).forEach((item, index) => {
    item.launchFrames = 0;
    item.x = index === 0 ? game.px : 192;
    item.y = index === 0 ? game.py : 1000;
  });
  game.update(); expect(game.items.count).toBe(0); expect(game.scene).toBe('departure');
  run(game, 58); expect(game.scene).toBe('departure');
  game.update(); expect(game.scene).toBe('clear');
});

it.each([1, 2, 3])('%s面のPower5・最高形態前だけlargeを5%でradiantに置き換える', (stage) => {
  for (const [power, awakened, roll, expected] of [
    [5, false, 0, 'radiant'], [5, false, 0.049999, 'radiant'],
    [5, false, 0.05, 'large'], [5, false, 0.999999, 'large'],
    [4.99, false, 0, 'large'], [5, true, 0, 'large'],
  ] as const) {
    const game = start(stage); conversation(game); game.power = power; game.awakened = awakened;
    vi.mocked(Math.random).mockReturnValue(roll);
    depart(game);
    expect(game.items.objects.filter((item) => item.active).map((item) => item.kind)).toEqual(['life', 'bomb', expected]);
  }
});

it('退場中は移動のみ許可し、ポーズで退場・回収・粒子・背景を止める', () => {
  const game = start(1); conversation(game); depart(game);
  game.autoshot = true; game.keys.add('ArrowRight');
  const x = game.px, bombs = game.bombs;
  press(game, 'KeyX'); expect(game.px).toBeGreaterThan(x); expect(game.bombs).toBe(bombs); expect(game.shots.count).toBe(0);
  game.keys.clear(); press(game, 'Escape');
  const state = [game.departureFrame, game.bossXY, game.sceneryDistance, game.items.objects[0].x, game.particles.objects[0].age];
  run(game, 120);
  expect([game.departureFrame, game.bossXY, game.sceneryDistance, game.items.objects[0].x, game.particles.objects[0].age]).toEqual(state);
  press(game, 'Escape'); game.update(); expect(game.departureFrame).toBe(2);
});

it.each([1, 2, 3, 4, 5])('?stage=%s&from=bossから通常の登場・全フェーズ・新しい撃破後フローへ進む', (stage) => {
  vi.stubGlobal('location', { search: `?stage=${stage}&from=boss&hp=0.03&invincible=1` });
  const game = new Game(); game.audio.volume = 0;
  run(game, 120 + (stage === 5 ? 90 + 150 + 60 + 120 : 80));
  expect(game.scene).toBe('dialogue');
  for (let i = 0; i < game.lines.length; i++) press(game);
  expect(game.scene).toBe('stage'); expect(game.phaseHp / game.phaseMaxHp).toBeCloseTo(0.03);
  while (game.phase) game.skipPhase();
  expect(game.transition).toBe('boss-defeat-flash');
  run(game, 8 + 90 + (stage >= 4 ? 150 : 0) + 60 + 120);
  expect(game.scene).toBe('dialogue'); expect(game.items.count).toBe(0);
});

it.each([1, 2, 3, 4, 5])('%s面は同じボス曲のゲインを1秒で35%へ下げ、対峙で1秒かけて戻す', async (stage) => {
  vi.useFakeTimers();
  try {
    const ramps: Array<Array<[number, number]>> = [];
    const fetchMock = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('AudioContext', class {
      state = 'running'; currentTime = 10; destination = {};
      createGain() {
        const calls: Array<[number, number]> = []; ramps.push(calls);
        const gain = { value: 1, cancelScheduledValues: () => {}, setValueAtTime: (value: number) => { gain.value = value; },
          linearRampToValueAtTime: (value: number, end: number) => { gain.value = value; calls.push([value, end]); } };
        return { gain, connect: (destination: unknown) => destination, disconnect: () => {} };
      }
      createBufferSource() { return { connect: (destination: unknown) => destination, start: () => {}, stop: () => {}, disconnect: () => {} }; }
      async decodeAudioData() { return { length: 10000, sampleRate: 1000, numberOfChannels: 1, getChannelData: () => new Float32Array(10000).fill(0.2) }; }
    });
    const game = start(stage); game.bgm.unlock();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledOnce();
    const voiceRamps = ramps[1]; voiceRamps.length = 0;
    game.skipPhase();
    expect(voiceRamps).toEqual([[0.35, 11]]);
    run(game, 8 + 90 + (stage >= 4 ? 150 : 0) + 59);
    expect(voiceRamps).toEqual([[0.35, 11]]);
    game.update(); expect(game.scene).toBe('arrival');
    expect(voiceRamps).toEqual([[0.35, 11], [1, 11]]);
    expect(fetchMock).toHaveBeenCalledOnce(); expect(ramps).toHaveLength(3);
    game.scene = 'clear'; game.update();
    await vi.advanceTimersByTimeAsync(1100);
  } finally { vi.clearAllTimers(); vi.useRealTimers(); }
});
