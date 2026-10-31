import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { DASH_ATTACK, DASH_MOVE, DASH_TRAIL_LIFE, ISSEN_BREAK, ISSEN_CHARGE, ISSEN_END, ISSEN_FADE, ISSEN_HOP, ISSEN_RECOVERY, issenCenter, issenScene } from './patterns/jinrai-issen';
import type { Difficulty } from './rules';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function start(difficulty: Difficulty = 'normal'): Game {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.difficulty = difficulty; game.startStage(4); game.startBoss(false, 10);
  return game;
}
function advance(game: Game, target: number): void {
  for (let i = 0; game.phaseFrame < target && i < 12000; i++) game.update();
  expect(game.phaseFrame).toBe(target);
}

it('溜め位置は上半分で毎周変わり、初回のカットイン後に余分な溜めを積まない', () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.1);
  const game = start(), first = [...game.jinraiIssen!.origin];
  expect(first[1]).toBeLessThan(224);
  advance(game, DASH_ATTACK);
  expect(game.cutin).toBe(0);
  expect(issenScene(game)?.moving).toBe(true);
  random.mockReturnValue(0.9);
  advance(game, DASH_ATTACK + ISSEN_END);
  const state = game.jinraiIssen!;
  expect(state.cycle).toBe(1);
  expect(state.origin).not.toEqual(first);
  expect(state.origin[1]).toBeLessThan(224);
  expect(state.attackFrame - state.chargeStart).toBe(ISSEN_CHARGE);
  expect(game.cutin).toBe(0);
});

it('発動1秒前のみみこを狙い、それ以降の移動を追尾しない', () => {
  const game = start();
  game.px = 80; game.py = 380;
  advance(game, DASH_ATTACK - 60);
  const state = game.jinraiIssen!, end = [...state.end];
  expect(state.aim).toEqual([80, 380]);
  const [ox, oy] = state.origin;
  expect((end[0] - ox) * (380 - oy) - (end[1] - oy) * (80 - ox)).toBeCloseTo(0);
  game.px = 320; game.py = 250;
  advance(game, DASH_ATTACK);
  expect(state.aim).toEqual([80, 380]); expect(state.end).toEqual(end);
  const from = game.bossXY;
  advance(game, DASH_ATTACK + DASH_MOVE);
  expect(game.bossXY).toEqual(end);
  expect(Math.hypot(end[0] - from[0], end[1] - from[1])).toBeGreaterThan(100);
  expect(state.trails.length).toBeGreaterThan(3);
  for (let i = 1; i < state.trails.length; i++) {
    expect(Math.hypot(state.trails[i].x - state.trails[i - 1].x, state.trails[i].y - state.trails[i - 1].y)).toBeCloseTo(24);
  }
  advance(game, DASH_ATTACK + DASH_MOVE + DASH_TRAIL_LIFE);
  expect(state.trails).toHaveLength(0);
});

it('高速横断の線分だけが当たり、予告と通過後の残光では被弾しない', () => {
  const game = start();
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  game.jinraiIssen!.origin = [80, 100];
  game.px = 300; game.py = 400;
  advance(game, DASH_ATTACK - 60);
  const [mx, my] = issenCenter(game.jinraiIssen!);
  game.invincible = false; game.px = mx; game.py = my;
  advance(game, DASH_ATTACK);
  expect(game.pendingHit).toBe(-1);
  advance(game, DASH_ATTACK + 4);
  expect(game.pendingHit).toBeGreaterThanOrEqual(0);
  game.pendingHit = -1;
  game.phaseFrame = DASH_ATTACK + DASH_MOVE;
  game.update();
  expect(game.pendingHit).toBe(-1);
});

it.each([[192, 439], [9, 250], [375, 250], [192, 12], [9, 439], [375, 12]])('画面端で静止していても一閃が狙った位置まで届く: %s,%s', (x, y) => {
  const game = start(); game.px = x; game.py = y;
  advance(game, DASH_ATTACK - 60);
  game.invincible = false; game.invulnFrames = 0;
  const lives = game.lives;
  advance(game, DASH_ATTACK + DASH_MOVE);
  expect(game.pendingHit).toBeGreaterThanOrEqual(0);
  for (let frame = 0; frame < 8; frame++) game.update();
  expect(game.lives).toBe(lives - 2);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('HPが半分以上でも軌跡中点から針と低速の花びらが出て、共通の通路を残す: %s', difficulty => {
  const game = start(difficulty);
  advance(game, DASH_ATTACK + ISSEN_BREAK - 1);
  expect(game.bullets.count).toBe(0);
  const center = issenCenter(game.jinraiIssen!);
  game.update();
  const needles = game.bullets.objects.filter(b => b.active);
  expect(needles.length).toBeGreaterThan(12);
  expect(needles.every(b => b.kind === 'needle')).toBe(true);
  for (const b of needles) {
    expect(b.x - b.vx).toBeCloseTo(center[0]); expect(b.y - b.vy).toBeCloseTo(center[1]);
  }
  const needleSpeed = Math.hypot(needles[0].vx, needles[0].vy);
  advance(game, DASH_ATTACK + ISSEN_BREAK + 24);
  const petals = game.bullets.objects.filter(b => b.active && b.kind === 'petal');
  expect(petals.length).toBeGreaterThan(20);
  expect(petals.every(b => b.motion === 'normal')).toBe(true);
  expect(Math.hypot(petals[0].vx, petals[0].vy)).toBeLessThan(needleSpeed * 0.6);
  const state = game.jinraiIssen!, aim = Math.atan2(state.aim![1] - center[1], state.aim![0] - center[0]);
  for (const b of [...needles, ...petals]) {
    const angle = Math.atan2(b.vy, b.vx);
    expect(Math.abs(Math.atan2(Math.sin(4 * (angle - aim)), Math.cos(4 * (angle - aim))) / 4)).toBeGreaterThan(0.08);
  }
});

it('HP半分以下は余波を一段足すが、一閃の回数や順番は変わらない', () => {
  const counts: number[] = [];
  for (const ratio of [1, 0.5]) {
    const game = start(); game.phaseHp *= ratio;
    const play = vi.spyOn(game.audio, 'play');
    advance(game, DASH_ATTACK + ISSEN_BREAK + 48);
    counts.push(game.bullets.count);
    expect(play.mock.calls.filter(([sound]) => sound === 'slash')).toHaveLength(1);
    expect(game.bossXY).toEqual(game.jinraiIssen!.end);
  }
  expect(counts[1]).toBeGreaterThan(counts[0] + 50);
});

it('転移は画面全域へ3回行い、0.5秒で透明から実体へ戻ってクナイを投げる', () => {
  const game = start();
  const play = vi.spyOn(game.audio, 'play');
  advance(game, DASH_ATTACK + ISSEN_RECOVERY - 1);
  vi.spyOn(Math, 'random').mockReturnValue(0.98);
  for (let index = 0; index < 3; index++) {
    const frame = DASH_ATTACK + ISSEN_RECOVERY + ISSEN_HOP * index;
    advance(game, frame);
    const target = game.jinraiIssen!.hops[index];
    expect(target[1]).toBeGreaterThan(350);
    expect(issenScene(game)?.opacity).toBe(1);
    advance(game, frame + ISSEN_FADE / 2);
    expect(issenScene(game)?.opacity).toBe(0);
    advance(game, frame + ISSEN_FADE);
    expect(issenScene(game)?.opacity).toBe(1);
    expect(game.bossXY).toEqual(target);
    advance(game, frame + 45);
    expect(game.bullets.objects.filter(b => b.active && b.kind === 'kunai' && b.age <= 1)).toHaveLength(7);
  }
  expect(play.mock.calls.filter(([sound]) => sound === 'jinraiWarp')).toHaveLength(4);
});

it('転移で消えている間はショットが通り抜け、実体化後はダメージが入る', () => {
  const game = start();
  const frame = DASH_ATTACK + ISSEN_RECOVERY;
  advance(game, frame + 10);
  const shot = game.shots.acquire()!, hp = game.phaseHp;
  Object.assign(shot, { x: game.bossXY[0], y: game.bossXY[1], vx: 0, vy: 0, damage: 10, radius: 30, homing: false });
  game.update();
  expect(game.phaseHp).toBe(hp); expect(shot.active).toBe(true);
  advance(game, frame + ISSEN_FADE);
  Object.assign(shot, { x: game.bossXY[0], y: game.bossXY[1] });
  game.update();
  expect(game.phaseHp).toBe(hp - 20);
});

it('ボムで消した余波は同じ周期に復活せず、次の一閃では再開する', () => {
  const game = start();
  advance(game, DASH_ATTACK + ISSEN_BREAK);
  expect(game.bullets.count).toBeGreaterThan(0);
  game.bombFrames = 2;
  game.update(); expect(game.bullets.count).toBe(0);
  advance(game, DASH_ATTACK + ISSEN_BREAK + 50);
  expect(game.bullets.count).toBe(0);
  advance(game, DASH_ATTACK + ISSEN_END);
  const next = game.jinraiIssen!.attackFrame;
  advance(game, next + ISSEN_BREAK);
  expect(game.bullets.objects.some(b => b.active && b.kind === 'needle')).toBe(true);
});

it('ポーズは狙い・転移・残像の時計を止め、リトライはサイクルを作り直す', () => {
  const game = start();
  advance(game, DASH_ATTACK + 5);
  const state = structuredClone(game.jinraiIssen), frame = game.phaseFrame;
  game.scene = 'pause';
  for (let i = 0; i < 100; i++) game.update();
  expect(game.phaseFrame).toBe(frame); expect(game.jinraiIssen).toEqual(state);
  game.scene = 'stage'; game.startBoss(false, 10);
  expect(game.phaseFrame).toBe(0); expect(game.jinraiIssen?.trails).toHaveLength(0);
  expect(game.jinraiIssen?.aim).toBeUndefined(); expect(game.jinraiIssen?.hops).toHaveLength(0);
});
