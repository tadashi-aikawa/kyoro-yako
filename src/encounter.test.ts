import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { STAGES } from './stages';

class Video extends EventTarget {
  src = '';
  muted = false;
  volume = 1;
  readyState = 4;
  currentTime = 0;
  duration = 10;
  error = null;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  emit(event: string): void { this.dispatchEvent(new Event(event)); }
}
const videos: Video[] = [];
const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void> = {};
const run = (game: Game, frames: number) => { for (let i = 0; i < frames; i++) game.update(); };
function press(game: Game, code: string): void {
  listeners.keydown({ code, repeat: false, preventDefault: () => {} });
  game.update(); listeners.keyup({ code, repeat: false, preventDefault: () => {} });
}
function fromBoss(stage = 5): Game {
  vi.stubGlobal('location', { search: `?stage=${stage}&from=boss` });
  return new Game();
}
const lastbossVideo = () => videos.find((video) => video.src.endsWith('/lastboss.mp4'))!;
beforeEach(() => {
  vi.useFakeTimers(); videos.length = 0;
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('Image', class { src = ''; });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof listeners[string]) => { listeners[kind] = listener; } });
  vi.stubGlobal('document', { createElement: () => { const video = new Video(); videos.push(video); return video; } });
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each([1, 2, 3, 4, 5])('%s面のfrom=bossは題字を省き、120フレーム後に本ボス演出へ進む', (stage) => {
  const game = fromBoss(stage);
  expect(game.stageIntroFrame).toBe(180); expect(game.scene).toBe('stage');
  expect(game.stageFrame).toBe(stage === 5 ? 2780 : 4780);
  run(game, 119); expect(game.scene).toBe('stage'); expect(game.enemies.count).toBe(0);
  game.update(); expect(game.scene).toBe(stage === 5 ? 'transition' : 'arrival');
  expect(game.midboss).toBe(false); expect(game.phase).toBeUndefined();
});

it.each([1, 2, 3, 4, 5])('%s面の中ボスは60フレーム降下し、20フレーム静止して会話へ進む', (stage) => {
  const game = new Game(); game.startStage(stage); game.stageIntroFrame = 180; game.stageFrame = 2449;
  game.spawnBullet(game.px, game.py, 0, 0, 0); game.enemies.acquire(); game.shots.acquire();
  game.pendingHit = 3; game.invulnFrames = 120; game.update();
  expect(game.scene).toBe('arrival'); expect(game.boss).toBe(STAGES[stage - 1].mid);
  expect(game.bullets.count).toBe(0); expect(game.enemies.count).toBe(0); expect(game.shots.count).toBe(0);
  expect(game.bossXY[1]).toBe(-48);
  const x = game.px; const distance = game.sceneryDistance; const clock = game.stageFrame;
  game.keys.add('ArrowRight'); game.keys.add('KeyZ'); game.autoshot = true;
  press(game, 'KeyX'); run(game, 59);
  expect(game.px).toBeGreaterThan(x); expect(game.bombs).toBe(3); expect(game.shots.count).toBe(0);
  expect(game.bossXY).toEqual([192, 132]); expect(game.arrivalFrame).toBe(60);
  expect(game.pendingHit).toBe(-1); expect(game.lives).toBe(2); expect(game.invulnFrames).toBe(59);
  expect(game.stageFrame).toBe(clock); expect(game.sceneryDistance).toBeGreaterThan(distance);
  run(game, 19); expect(game.scene).toBe('arrival'); expect(game.bossXY).toEqual([192, 132]);
  game.update(); expect(game.scene).toBe('dialogue'); expect(game.afterDialogue).toBe('mid');
});

it.each([1, 2, 3, 4])('%s面の本ボスは登場後に会話し、次に戦闘へ入る', (stage) => {
  const game = fromBoss(stage); expect(game.bgm.cue).toBe(STAGES[stage - 1].bgm); run(game, 120 + 60);
  expect(game.bgm.cue).toBe(`boss-${STAGES[stage - 1].boss}`);
  expect(game.boss).toBe(STAGES[stage - 1].boss); expect(game.bossXY).toEqual([192, 77]);
  run(game, 20); expect(game.scene).toBe('dialogue');
  expect(game.bgm.cue).toBe(`boss-${STAGES[stage - 1].boss}`);
  for (let i = 0; i < game.lines.length; i++) press(game, 'KeyZ');
  expect(game.scene).toBe('stage'); expect(game.phaseFrame).toBe(0);
  game.update(); expect(game.phaseFrame).toBe(1);
});

it.each([false, true])('boss直行では登場を省き、直ちに戦闘の時計を進める mid=%s', (mid) => {
  vi.stubGlobal('location', { search: `?boss=3&phase=1${mid ? '&mid=1' : ''}` });
  const game = new Game(); expect(game.scene).toBe('stage'); game.update(); expect(game.phaseFrame).toBe(1);
});

it('登場中のポーズは降下と背景を止め、解除すると再開する', () => {
  const game = fromBoss(1); run(game, 130); press(game, 'Escape');
  const frame = game.arrivalFrame; const xy = game.bossXY; const distance = game.sceneryDistance;
  run(game, 100); expect(game.arrivalFrame).toBe(frame); expect(game.bossXY).toEqual(xy); expect(game.sceneryDistance).toBe(distance);
  press(game, 'Escape'); game.update(); expect(game.arrivalFrame).toBe(frame + 1);
});

it.each([0, 1, 2, 3, 4, 5, 6, 7])('道中最後の被弾猶予%sは登場開始時に取り消し、戦闘へ持ち越さない', (pending) => {
  for (const role of ['boss', 'midboss', 'lastboss']) {
    const game = new Game(); game.startStage(role === 'lastboss' ? 5 : 1); game.stageIntroFrame = 180;
    game.midbossElapsedFrames = 6000; game.stageFrame = role === 'midboss' ? 2449 : role === 'lastboss' ? 2899 : 4899;
    game.pendingHit = pending; game.invulnFrames = 0; game.update();
    expect(game.pendingHit).toBe(-1);
    if (role === 'lastboss') { run(game, 45); (game.movies.current as unknown as Video).emit('ended'); }
    run(game, 80); expect(game.scene).toBe('dialogue');
    for (let i = 0; i < game.lines.length; i++) press(game, 'KeyZ');
    run(game, 8); expect(game.scene).toBe('stage'); expect(game.lives).toBe(2); expect(game.pendingHit).toBe(-1);
  }
});

it.each([0, 15, 29])('白からの登場%sフレーム目にポーズしても白を保ち、解除後にフェードを再開する', (frame) => {
  const game = fromBoss(); run(game, 165); lastbossVideo().emit('ended'); run(game, frame);
  const alpha = game.whiteAlpha; press(game, 'Escape');
  expect(game.scene).toBe('pause'); expect(game.whiteAlpha).toBe(alpha);
  run(game, 120); expect(game.whiteAlpha).toBe(alpha); expect(game.arrivalFrame).toBe(frame);
  press(game, 'Escape'); expect(game.scene).toBe('arrival'); expect(game.whiteAlpha).toBe(alpha);
  game.update(); expect(game.whiteAlpha).toBeCloseTo(Math.max(0, 1 - (frame + 1) / 30));
});

it('5面は45フレームで白へ進み、動画の前後30フレームを白とクロスフェードする', () => {
  const game = fromBoss(); run(game, 120);
  expect(game.transition).toBe('lastboss-in'); expect(game.whiteAlpha).toBe(0);
  run(game, 22); expect(game.whiteAlpha).toBeCloseTo(22 / 45);
  run(game, 23); expect(game.scene).toBe('movie'); expect(game.whiteAlpha).toBe(1);
  const video = lastbossVideo(); expect(video.muted).toBe(true); expect(game.bgm.cue).toBeNull();
  video.currentTime = 0.25; expect(game.whiteAlpha).toBe(0.5);
  video.currentTime = 0.5; expect(game.whiteAlpha).toBe(0);
  video.currentTime = 9.75; expect(game.whiteAlpha).toBe(0.5);
  video.currentTime = 10; video.emit('ended');
  expect(game.scene).toBe('arrival'); expect(game.whiteAlpha).toBe(1); expect(game.boss).toBe('minerva');
  run(game, 15); expect(game.whiteAlpha).toBe(0.5); run(game, 15); expect(game.whiteAlpha).toBe(0);
  run(game, 50); expect(game.scene).toBe('dialogue'); expect(game.afterDialogue).toBe('boss');
});

it.each(['KeyZ', 'KeyX'])('lastbossの%sスキップでも映像を止めて30フレームで白へ進む', async (key) => {
  const game = fromBoss(); run(game, 165); await vi.advanceTimersByTimeAsync(0);
  const video = lastbossVideo(); video.currentTime = 4;
  video.emit('waiting'); vi.advanceTimersByTime(990);
  press(game, key); expect(game.scene).toBe('transition'); expect(game.transition).toBe('lastboss-out');
  expect(game.movies.current).toBe(video); expect(video.pause).toHaveBeenCalled();
  vi.advanceTimersByTime(20); video.emit('ended'); expect(game.scene).toBe('transition');
  run(game, 15); expect(game.whiteAlpha).toBe(0.5);
  run(game, 15); expect(game.scene).toBe('arrival'); expect(game.whiteAlpha).toBe(1);
  expect(game.movies.current).toBeUndefined(); run(game, 80); expect(game.scene).toBe('dialogue');
});

it('lastboss未配置でも45フレームの白フェード後にミネルヴァ登場へ進む', () => {
  vi.stubGlobal('document', undefined); const game = fromBoss(); run(game, 165);
  expect(game.scene).toBe('arrival'); expect(game.whiteAlpha).toBe(1);
  run(game, 80); expect(game.scene).toBe('dialogue');
});

it('撃破後の会話では登場演出を繰り返さない', () => {
  const game = new Game(); game.startStage(1); game.startBoss(false, 6); game.skipPhase(); run(game, 180);
  expect(game.scene).toBe('dialogue'); expect(game.afterDialogue).toBe('clear');
});

it('openingとendingには白フェードを付けない', () => {
  for (const name of ['opening', 'ending-1']) {
    vi.stubGlobal('location', { search: `?movie=${name}` }); const game = new Game();
    expect(game.whiteAlpha).toBe(0); press(game, 'KeyX');
    expect(game.scene).toBe(name === 'opening' ? 'stage' : 'ending'); expect(game.whiteAlpha).toBe(0);
  }
});
