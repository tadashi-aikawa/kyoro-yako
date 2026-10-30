import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { STITCH_REVEAL, STITCH_WARNING, SUGAR_WARNING, sugarCasting, YOYO_BOTTOM, YOYO_FLIGHT, YOYO_WARNING, yoyoPeriod } from './patterns/chappy';
import { midPhases } from './stages';

const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void> = {};
beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof listeners[string]) => { listeners[kind] = listener; } });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function start(index = 0, difficulty: Game['difficulty'] = 'normal'): Game {
  const game = new Game(); game.audio.volume = 0; game.difficulty = difficulty;
  game.startStage(3); game.startBoss(true, index); game.phaseFrame = 104; game.update();
  return game;
}
function run(game: Game, frames: number): void { for (let i = 0; i < frames; i++) game.update(); }
function key(code: string): void { listeners.keydown({ code, repeat: false, preventDefault: () => {} }); }

it('新3技へ直行でき、合計HPはPower3の理論40秒未満に収まる', () => {
  expect(midPhases('chappy').map((p) => p.name)).toEqual(['スリーピー・ヨーヨー', 'リトル・ステッチ', 'シュガー・スナップ']);
  expect(midPhases('chappy').reduce((sum, p) => sum + p.hp, 0) / 48.6).toBeLessThan(40);
  for (let index = 0; index < 3; index++) {
    vi.stubGlobal('location', { search: `?boss=3&mid=1&phase=${index}` });
    const game = new Game();
    expect(game.phase).toBe(midPhases('chappy')[index]); expect(game.remainingSpells).toBe(3 - index);
  }
});

it('各技の時間切れで補充し、3→2→1→0のあとに回収・会話・道中へ進む', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.9);
  const game = start(); game.invincible = true;
  const stageFrame = game.stageFrame;
  for (let index = 0; index < 3; index++) {
    for (let frame = 0; game.phaseIntro && frame < 300; frame++) game.update();
    expect(game.phaseIntro).toBeUndefined(); game.items.clear();
    game.phaseFrame = game.phase!.duration * 60 - 1; game.update();
    expect(game.items.objects.filter((i) => i.active && i.manual && i.kind === 'small')).toHaveLength(10);
    expect(game.remainingSpells).toBe(2 - index); expect(game.bullets.count).toBe(0); expect(game.stageFrame).toBe(stageFrame);
  }
  expect(game.phase).toBeUndefined(); expect(game.collectionFrames).toBe(180);
  run(game, 180); expect(game.scene).toBe('dialogue');
  game.keys.add('ControlLeft'); run(game, 30);
  expect(game.scene).toBe('stage'); expect(game.boss).toBeUndefined();
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sのヨーヨーは画面内で往復し、全回収後に同じ弾を投げ直す', (difficulty) => {
  const game = start(0, difficulty); game.invincible = true;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const original = game.bullets.objects.filter((b) => b.active), lead = original[0];
  const count = original.length; const origin = [lead.x, lead.y];
  run(game, YOYO_WARNING[level]); expect([lead.x, lead.y]).toEqual(origin);
  run(game, Math.floor(YOYO_FLIGHT[level] / 2));
  expect(lead.y).toBeCloseTo(lead.swayPhase); expect(Math.max(...original.map((b) => b.y))).toBeCloseTo(YOYO_BOTTOM); expect(lead.y).toBeLessThan(448);
  run(game, Math.ceil(YOYO_FLIGHT[level] / 2) + 16);
  expect(original.every((b) => Math.hypot(b.x - origin[0], b.y - origin[1]) < 0.001)).toBe(true);
  run(game, yoyoPeriod(level));
  expect(game.bullets.count).toBe(count);
  expect(game.bullets.objects.filter((b) => b.active)).toEqual(original);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sの縫い目は実体化の前に24フレームの合図を出す', (difficulty) => {
  const game = start(1, difficulty); game.invincible = true;
  const states = new Map<import('./game').Bullet, { warning: number; previous: number }>();
  let transitions = 0;
  for (let i = 1; i < 1200; i++) {
    game.update();
    for (const line of game.bullets.objects.filter((b) => b.active && b.gridColumn === 0)) {
      const state = states.get(line) ?? { warning: 0, previous: 0 };
      if (line.dashOrder === 1) state.warning++;
      if (line.dashOrder === 2 && state.previous !== 2) { expect(state.warning).toBeGreaterThanOrEqual(STITCH_WARNING); state.warning = 0; transitions++; }
      if (line.dashOrder === 0) state.warning = 0;
      state.previous = line.dashOrder; states.set(line, state);
    }
  }
  expect(transitions).toBeGreaterThan(0);
});

it('点線の縫い目とスナップの溜めには接触・グレイズ判定がなく、実体には当たる', () => {
  for (const index of [1, 2]) {
    const game = start(index); game.invulnFrames = 0;
    const b = game.bullets.objects.find((bullet) => bullet.active)!;
    if (index === 1) { b.y = 150; }
    for (let i = 0; i < 10; i++) { game.px = b.x; game.py = b.y; game.update(); }
    expect(game.pendingHit).toBe(-1); expect(game.graze).toBe(0);
    if (index === 1) run(game, STITCH_REVEAL - b.age);
    else run(game, b.releaseAt - b.age);
    game.invulnFrames = 0; game.px = b.x + b.vx; game.py = b.y + b.vy; game.update();
    expect(game.pendingHit).toBeGreaterThanOrEqual(0);
  }
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sで下端のヨーヨーと本体直下の縫い目を静止して避け続けられない', (difficulty) => {
  for (const [phase, x, y] of [[0, 192, 439], [0, 150, 436], [1, 192, 139], [1, 170, 137]]) {
    const game = start(phase, difficulty); game.px = x; game.py = y; game.invulnFrames = 0;
    for (let i = 0; i < 1500 && game.pendingHit < 0 && game.lives === 3; i++) game.update();
    expect(game.pendingHit >= 0 || game.lives < 3, `${phase}:${x},${y}`).toBe(true);
  }
});

it('ボムで飛ばしたスナップの波では前進も構えも残らない', () => {
  const game = start(2); game.bullets.clear(); game.phaseFrame = 105 + SUGAR_WARNING[1] - 1;
  expect(game.bossPosition()).toEqual([192, 132]); expect(sugarCasting(game)).toBe(false);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sのヨーヨーは本体の斜め下の帯にも糸を予告して投げ返す', (difficulty) => {
  for (const x of [160, 168, 172, 176, 208, 212, 216, 224]) for (const y of [136, 140, 146, 156, 164]) {
    const game = start(0, difficulty); game.px = x; game.py = y; game.invulnFrames = 0;
    for (let i = 0; i < 1500 && game.pendingHit < 0 && game.lives === 3; i++) game.update();
    expect(game.pendingHit >= 0 || game.lives < 3, `${x},${y}`).toBe(true);
  }
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sで投げる直前だけ本体の上へ往復してもヨーヨーの脇に居続けられない', (difficulty) => {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  for (const [x, y] of [[172, 140], [212, 146]]) {
    const game = start(0, difficulty); game.px = x; game.py = y; game.invulnFrames = 0;
    for (let i = 0; i < 1500 && game.pendingHit < 0 && game.lives === 3; i++) {
      const local = (game.phaseFrame - 105) % yoyoPeriod(level), target = local < 8 || local > yoyoPeriod(level) - 8 ? 124 : y;
      game.py += Math.max(-3.65, Math.min(3.65, target - game.py)); game.update();
    }
    expect(game.pendingHit >= 0 || game.lives < 3, `${x},${y}`).toBe(true);
  }
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sのスナップは方向を固定し、1回の音で一斉に加速する', (difficulty) => {
  const game = start(2, difficulty); game.invincible = true;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  const bullets = game.bullets.objects.filter((b) => b.active);
  const directions = bullets.map((b) => [b.targetX, b.targetY]);
  run(game, SUGAR_WARNING[level] - 2);
  game.px = 370; game.py = 420;
  expect(bullets.every((b) => b.delay === 1)).toBe(true);
  expect(play).not.toHaveBeenCalledWith('chappySnap');
  game.update();
  expect(bullets.every((b) => b.delay === 0)).toBe(true);
  expect(bullets.map((b) => [b.vx, b.vy])).toEqual(directions);
  expect(play.mock.calls.filter(([sound]) => sound === 'chappySnap')).toHaveLength(1);
  expect(play).not.toHaveBeenCalledWith('enemyShot');
});

it.each([0, 1, 2])('技%sのボムで予告・弾・後続の加速を消し、ボム中は再発射しない', (index) => {
  const game = start(index); const original = game.bullets.objects.filter((b) => b.active);
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  key('KeyX'); game.update(); game.keys.delete('KeyX');
  run(game, 120);
  expect(game.bullets.count).toBe(0); expect(original.every((b) => !b.active)).toBe(true);
  expect(play).not.toHaveBeenCalledWith('chappySnap');
});

it.each([0, 1, 2])('技%sのポーズ中は移動・予告・フェーズ時計が止まる', (index) => {
  const game = start(index), b = game.bullets.objects.find((bullet) => bullet.active)!;
  key('Escape'); game.update(); game.keys.delete('Escape');
  const snapshot = [b.age, b.x, b.y, b.delay, b.dashOrder, game.phaseFrame];
  run(game, 60); expect([b.age, b.x, b.y, b.delay, b.dashOrder, game.phaseFrame]).toEqual(snapshot);
});
