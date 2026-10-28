import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { FIELD, MAX_BOMBS } from './rules';

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
const video = () => videos.find((entry) => entry.src.endsWith('/jinrai-gift.mp4'))!;
function press(game: Game, code = 'KeyZ'): void {
  listeners.keydown({ code, repeat: false, preventDefault: () => {} });
  game.update(); listeners.keyup({ code, repeat: false, preventDefault: () => {} });
}
function defeat(stage = 4, mid = false): Game {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(stage); game.startBoss(mid, 999);
  game.skipPhase(); run(game, mid ? 180 : 98);
  return game;
}
function gift(): Game {
  const game = defeat(); video().emit('ended'); run(game, 150 + 60 + 120);
  for (let i = 0; i < game.lines.length; i++) press(game);
  return game;
}
function finishGift(game: Game): void {
  // テストの無限待ちだけを防ぐ。ゲーム内の餞別には時間制限を設けない。
  for (let i = 0; i < 600 && game.scene === 'gift'; i++) game.update();
  expect(game.scene).toBe('departure');
  for (let i = 0; i < 300 && game.scene === 'departure'; i++) game.update();
  expect(game.scene).toBe('clear');
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

it.each([false, true])('4面本ボス撃破は白→動画→対峙→会話→餞別→退場→クリアへ進む practice=%s', (practice) => {
  const game = new Game(); game.audio.volume = 0; game.practice = practice;
  game.startStage(4); game.startBoss(false, 999); game.skipPhase();
  expect(game.transition).toBe('boss-defeat-flash'); expect(game.items.count).toBe(0);
  run(game, 8); expect(game.transition).toBe('boss-defeat-in'); expect(game.whiteAlpha).toBe(0);
  run(game, 45); expect(game.whiteAlpha).toBe(0.5);
  expect(video().play).not.toHaveBeenCalled();
  run(game, 45); expect(game.debugState).toMatchObject({ scene: 'movie', movie: 'jinrai-gift', bgm: 'boss-jinrai', bgmMultiplier: 0.35 });
  expect(video().muted).toBe(true); expect(game.whiteAlpha).toBe(1);
  video().currentTime = 0.75; expect(game.whiteAlpha).toBeCloseTo(0.5);
  video().currentTime = 5; expect(game.whiteAlpha).toBe(0);
  video().currentTime = 10; expect(game.whiteAlpha).toBe(0);
  video().emit('ended'); expect(game.transition).toBe('jinrai-gift-out'); expect(game.movies.current).toBe(video());
  run(game, 75); expect(game.whiteAlpha).toBe(0.5);
  run(game, 75); expect(game.transition).toBe('boss-defeat-hold'); expect(game.whiteAlpha).toBe(1);
  run(game, 60); expect(game.scene).toBe('arrival'); expect(game.bossXY).toEqual([192, 77]);
  expect(game.bgm.sceneVolumeMultiplier).toBe(1);
  press(game); expect(game.lineIndex).toBe(0); run(game, 59); expect(game.whiteAlpha).toBe(0.5);
  run(game, 60); expect(game.scene).toBe('dialogue'); expect(game.whiteAlpha).toBe(0);
  expect(game.afterDialogue).toBe('gift'); expect(game.boss).toBe('jinrai');
  expect(game.lines).toEqual([
    { who: 'jinrai', text: '……ふふ、やられたわ。あんさん、ええ一撃やったえ。' },
    { who: 'mimiko', text: 'ふわっ。……あたしも、まだ胸がどきどきしてるの。' },
    { who: 'jinrai', text: 'あと少しや。これ持ってき。あんさんなら、最後も勝てるやろ。' },
    { who: 'mimiko', text: 'ありがとうなの。大事に使うのね。' },
  ]);
  for (let i = 0; i < game.lines.length; i++) press(game);
  expect(game.scene).toBe('gift'); expect(game.bossXY).toEqual([192, 77]); expect(game.bgm.cue).toBe('boss-jinrai');
  finishGift(game); expect(game.items.objects.some((item) => item.active && item.gift)).toBe(false);
  expect(game.awakened).toBe(true); expect(game.power).toBe(5); expect(game.bgm.cue).toBeNull();
});

it.each(['KeyZ', 'KeyX'])('動画を%sでスキップすると静止映像を150フレームで白へ溶かす', async (key) => {
  const game = defeat(); await vi.advanceTimersByTimeAsync(0);
  video().currentTime = 5; press(game, key);
  expect(game.transition).toBe('jinrai-gift-out'); expect(game.movies.current).toBe(video());
  video().emit('ended'); run(game, 75); expect(game.whiteAlpha).toBe(0.5);
  run(game, 75); expect(game.transition).toBe('boss-defeat-hold'); expect(game.whiteAlpha).toBe(1);
  expect(game.movies.current).toBeUndefined(); expect(video().pause).toHaveBeenCalled();
  run(game, 60 + 120); expect(game.scene).toBe('dialogue');
});

it.each([1, 2, 3])('%s面の本ボス後に餞別を出さない', (stage) => {
  const game = defeat(stage);
  run(game, 60 + 120);
  expect(game.scene).toBe('dialogue'); expect(game.afterDialogue).toBe('clear');
  for (let i = 0; i < game.lines.length; i++) press(game);
  expect(game.scene).toBe('departure'); expect(game.items.count).toBe(3);
  for (let i = 0; i < 600 && game.scene === 'departure'; i++) game.update();
  expect(game.scene).toBe('clear'); expect(game.giftFrame).toBe(0); expect(video()).toBeUndefined();
});

it('4面中ボス後にも餞別を出さない', () => {
  const game = defeat(4, true);
  expect(game.scene).toBe('stage'); expect(game.boss).toBeUndefined();
  expect(video().play).not.toHaveBeenCalled();
});

it('ライフ3個・ボム3個・羽根1個を扇状に投げ、移動を許可して射撃とボムを止める', () => {
  const game = gift(); const items = game.items.objects.filter((item) => item.active && item.gift);
  expect(items.filter((item) => item.kind === 'life')).toHaveLength(3);
  expect(items.filter((item) => item.kind === 'bomb')).toHaveLength(3);
  expect(items.filter((item) => item.kind === 'radiant')).toHaveLength(1);
  expect(items.every((item) => item.auto && item.x === 192 && item.y === 77)).toBe(true);
  expect(new Set(items.map((item) => item.vx)).size).toBe(7);
  const x = game.px; const bombs = game.bombs; const clock = game.stageFrame;
  game.autoshot = true; game.keys.add('ArrowRight'); game.keys.add('KeyZ'); press(game, 'KeyX'); run(game, 24);
  expect(game.px).toBeGreaterThan(x); expect(game.shots.count).toBe(0); expect(game.bombs).toBe(bombs);
  expect(game.stageFrame).toBe(clock); expect(items[0].x).toBeLessThan(192); expect(items[6].x).toBeGreaterThan(192);
  expect(items.every((item) => item.active && item.launchFrames > 0)).toBe(true);
  const peak = items[3].y; expect(peak).toBeLessThan(77);
  run(game, 25);
  expect(items.every((item) => item.active && item.launchFrames === 0 && item.vy > 0)).toBe(true);
  expect(items[3].y).toBeGreaterThan(peak);
});

it.each([0, 1, 4.99, 5])('餞別の羽根はPower%sから最高形態にし、取得した分だけ残機・ボムを増やす', (power) => {
  const game = gift(); game.power = power; game.lives = 2; game.bombs = MAX_BOMBS - 1;
  game.items.forEach((item) => { if (!item.gift) item.active = false; });
  const lifeItems = game.items.objects.filter((item) => item.active && item.gift && item.kind === 'life').length;
  const lives = game.lives; finishGift(game);
  expect(game.scene).toBe('clear'); expect(game.power).toBe(5); expect(game.awakened).toBe(true);
  expect(game.lives).toBe(lives + lifeItems); expect(game.bombs).toBe(MAX_BOMBS);
  expect(game.items.objects.filter((item) => item.active && item.gift)).toHaveLength(0);
});

it('全品回収した場合は直ちに退場を始め、光の消失後に90フレーム待ってクリアへ進む', () => {
  const game = gift(); game.items.forEach((item) => {
    if (item.gift) { item.launchFrames = 0; item.x = game.px; item.y = game.py; }
  });
  game.update(); expect(game.scene).toBe('departure'); expect(game.giftFrame).toBe(1);
  run(game, 59); expect(game.scene).toBe('departure');
  game.update(); expect(game.scene).toBe('departure');
  while (game.particles.count > 0) game.update();
  run(game, 89); expect(game.scene).toBe('departure');
  game.update(); expect(game.scene).toBe('clear');
});

it.each([false, true])('餞別前の状態でクリアボーナスを確定し、配った残機・ボム・Powerを加算しない 全品消失=%s', (lost) => {
  const game = defeat(); video().emit('ended'); run(game, 150 + 60 + 120);
  game.score = 0; game.lives = 2; game.bombs = 1; game.power = 1.5; game.point = 10000; game.graze = 7;
  game.items.clear();
  for (let i = 0; i < game.lines.length; i++) press(game);
  expect(game.scene).toBe('gift'); expect(game.score).toBe(0);
  expect(game.clearBonus).toBe(4_710_700);
  if (lost) game.items.forEach((item) => { item.x = -1000; });
  finishGift(game);
  expect(game.scene).toBe('clear'); expect(game.clearBonus).toBe(4_710_700); expect(game.score).toBe(4_710_700);
  expect(game.lives).toBe(lost ? 2 : 5); expect(game.bombs).toBe(lost ? 1 : 4);
  expect(game.power).toBe(lost ? 1.5 : 5); expect(game.awakened).toBe(!lost);
});

it('50フレームの投擲後は遠距離でも毎フレーム4px以下で吸引する', () => {
  const game = gift(); game.items.forEach((item) => { if (!item.gift) item.active = false; });
  run(game, 50);
  const item = game.items.objects.find((item) => item.active && item.gift)!;
  const y = item.y;
  for (let i = 0; i < 20; i++) {
    const x = item.x; const y = item.y; game.update();
    expect(Math.hypot(item.x - x, item.y - y)).toBeLessThanOrEqual(4.000001);
  }
  expect(item.y).toBeGreaterThan(y); expect(item.active).toBe(true);
});

it.each([1, 2, 3])('%s面の退場報酬は4面の餞別と同じ軌道・速度で投げて吸引する', (stage) => {
  const reference = gift();
  const referenceItems = reference.items.objects.filter((item) => item.active && item.gift);
  const game = defeat(stage); run(game, 60 + 120);
  for (let i = 0; i < game.lines.length; i++) press(game);
  const items = game.items.objects.filter((item) => item.active);
  expect(items).toHaveLength(3);
  for (let frame = 1; frame <= 121; frame++) {
    const previous = items.map(({ x, y }) => ({ x, y }));
    reference.update(); game.update();
    items.forEach((item, index) => {
      const other = referenceItems[index * 3];
      expect(item.active).toBe(other.active); expect(item.launchFrames).toBe(other.launchFrames);
      expect(item.x).toBeCloseTo(other.x); expect(item.y).toBeCloseTo(other.y);
      expect(item.vx).toBeCloseTo(other.vx); expect(item.vy).toBeCloseTo(other.vy);
      if (frame > 50) expect(Math.hypot(item.x - previous[index].x, item.y - previous[index].y)).toBeLessThanOrEqual(4.000001);
    });
  }
  expect(game.scene).toBe('departure'); expect(game.items.count).toBeGreaterThan(0);
});

it('120フレームを過ぎても残りを強制回収せず、取得が終わるまで待つ', () => {
  const game = gift(); game.items.forEach((item) => { if (!item.gift) item.active = false; });
  game.px = FIELD.w - 9; game.py = FIELD.h - 9; game.lives = 2;
  run(game, 121);
  expect(game.scene).toBe('gift'); expect(game.giftFrame).toBe(121);
  const remainingLives = game.items.objects.filter((item) => item.active && item.gift && item.kind === 'life').length;
  expect(remainingLives).toBeGreaterThan(0); expect(game.lives).toBe(5 - remainingLives);
  finishGift(game);
  expect(game.lives).toBe(5); expect(game.giftFrame).toBeGreaterThan(121);
});

it.each([[-100, 200], [FIELD.w + 100, 200], [192, -100], [192, FIELD.h + 100]])('画面外の餞別を取得扱いにせず消してクリアへ進む x=%s y=%s', (x, y) => {
  const game = gift(); game.score = 0; game.lives = 2; game.bombs = 3; game.power = 0;
  game.items.forEach((item) => {
    if (!item.gift) item.active = false;
    else { item.x = x; item.y = y; }
  });
  game.update();
  expect(game.scene).toBe('departure'); expect(game.items.objects.some((item) => item.active && item.gift)).toBe(false);
  for (let i = 0; i < 300 && game.scene === 'departure'; i++) game.update();
  expect(game.scene).toBe('clear');
  expect(game.lives).toBe(2); expect(game.bombs).toBe(3); expect(game.power).toBe(0); expect(game.awakened).toBe(false);
  expect(game.score).toBe(game.clearBonus);
});

it('羽根だけが画面外へ消えても残りの取得を待ち、消えた羽根で最高形態にしない', () => {
  const game = gift(); game.items.forEach((item) => { if (!item.gift) item.active = false; });
  const feather = game.items.objects.find((item) => item.active && item.kind === 'radiant')!;
  feather.y = FIELD.h + 100; game.power = 0;
  game.update();
  expect(game.scene).toBe('gift'); expect(feather.active).toBe(false);
  finishGift(game);
  expect(game.power).toBe(0); expect(game.awakened).toBe(false);
});

it('餞別中は背景とパーティクルを進め、ポーズでは両方を止める', () => {
  const game = gift(); game.particles.clear();
  const particle = game.particles.acquire()!;
  Object.assign(particle, { x: 10, y: 20, vx: 2, vy: -1, age: 0, life: 3 });
  const distance = game.sceneryDistance; const clock = game.stageFrame;
  game.update();
  expect(game.sceneryDistance).toBeCloseTo(distance + 1.8);
  expect(particle).toMatchObject({ x: 12, y: 19, age: 1, active: true });
  press(game, 'Escape'); run(game, 30);
  expect(game.sceneryDistance).toBeCloseTo(distance + 1.8);
  expect(particle).toMatchObject({ x: 12, y: 19, age: 1, active: true });
  press(game, 'Escape'); run(game, 2);
  expect(game.sceneryDistance).toBeCloseTo(distance + 5.4);
  expect(particle).toMatchObject({ x: 16, y: 17, age: 3, active: false });
  expect(game.stageFrame).toBe(clock);
});

it('餞別中のポーズは投擲と時計を止め、再開後に回収を続ける', () => {
  const game = gift(); run(game, 12); const item = game.items.objects.find((item) => item.active && item.gift)!;
  const x = item.x; press(game, 'Escape'); run(game, 120);
  expect(game.scene).toBe('pause'); expect(game.giftFrame).toBe(12); expect(item.x).toBe(x);
  press(game, 'Escape'); finishGift(game);
});

it.each(['missing', 'decode', 'timeout', 'rejected'] as const)('動画の%sでも白から対峙・会話・餞別へ進む', async (failure) => {
  const game = new Game(); game.audio.volume = 0; game.startStage(4); game.startBoss(false, 999); game.skipPhase();
  if (failure === 'missing') { video().error = {}; video().emit('error'); }
  if (failure === 'timeout') video().readyState = 0;
  if (failure === 'rejected') video().play.mockRejectedValueOnce(new Error('decode failed'));
  run(game, 98);
  if (failure === 'decode') video().emit('error');
  await vi.advanceTimersByTimeAsync(1000);
  expect(game.transition).toBe('jinrai-gift-out');
  run(game, 150); expect(game.whiteAlpha).toBe(1);
  run(game, 60 + 120); expect(game.scene).toBe('dialogue');
  for (let i = 0; i < game.lines.length; i++) press(game);
  expect(game.scene).toBe('gift'); finishGift(game);
});

it('?movie=jinrai-giftの終了後は4面の撃破後会話へ進む', () => {
  vi.stubGlobal('location', { search: '?movie=jinrai-gift' }); const game = new Game();
  expect(game.stage).toBe(4); expect(game.movieName).toBe('jinrai-gift'); video().emit('ended');
  run(game, 150 + 60 + 120);
  expect(game.debugState).toMatchObject({ scene: 'dialogue', stage: 4, boss: '迅雷', bgm: 'boss-jinrai' });
  expect(game.afterDialogue).toBe('gift');
  for (let i = 0; i < game.lines.length; i++) press(game);
  expect(game.scene).toBe('gift');
});
