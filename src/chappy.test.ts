import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { CAROM_BURST, CAROM_CAP, CAROM_PERIOD, CAROM_SPEED, CAROM_WARNING, SUGAR_WARNING, sugarCasting, YOYO_BOTTOM, YOYO_FLIGHT, YOYO_STATIONS, YOYO_WARNING, yoyoPeriod } from './patterns/chappy';
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
  expect(midPhases('chappy').map((p) => p.name)).toEqual(['スリーピー・ヨーヨー', 'キャンディ・キャロム', 'シュガー・スナップ']);
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
    for (let frame = 0; game.phaseIntro && frame < 480; frame++) game.update();
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
  const destination = YOYO_STATIONS[1];
  expect(original.every((b) => Math.hypot(b.x - destination[0], b.y - destination[1]) < 0.001)).toBe(true);
  expect(game.bossPosition()).toEqual([...destination]);
  run(game, yoyoPeriod(level));
  expect(game.bullets.count).toBe(count);
  expect(game.bullets.objects.filter((b) => b.active)).toEqual(original);
});

it('キャロムとスナップの溜めは無害で、発射したボールには当たる', () => {
  for (const index of [1, 2]) {
    const game = start(index); game.invulnFrames = 0;
    const b = game.bullets.objects.find((bullet) => bullet.active)!;
    for (let i = 0; i < 10; i++) { game.px = b.x; game.py = b.y; game.update(); }
    expect(game.pendingHit).toBe(-1); expect(game.graze).toBe(0);
    const warning = index === 1 ? CAROM_WARNING : b.releaseAt;
    run(game, warning - b.age - 1);
    expect(game.pendingHit).toBe(-1);
    game.invulnFrames = 0; game.px = b.x + (index === 1 ? b.vx : b.targetX); game.py = b.y + (index === 1 ? b.vy : b.targetY); game.update();
    expect(game.pendingHit).toBeGreaterThanOrEqual(0);
  }
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sでヨーヨーの下端を静止して避け続けられない', (difficulty) => {
  for (const [phase, x, y] of [[0, 192, 439], [0, 150, 436]]) {
    const game = start(phase, difficulty); game.px = x; game.py = y; game.invulnFrames = 0;
    for (let i = 0; i < 1500 && game.pendingHit < 0; i++) game.update();
    expect(game.pendingHit, `${phase}:${x},${y}`).toBeGreaterThanOrEqual(0);
  }
});

it('ボムで飛ばしたスナップの波では前進も構えも残らない', () => {
  const game = start(2); game.bullets.clear(); game.phaseFrame = 105 + SUGAR_WARNING[1] - 1;
  expect(game.bossPosition()).toEqual([192, 132]); expect(sugarCasting(game)).toBe(false);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sのヨーヨーは放った後にゆっくり動き、移動先から次を投げる', (difficulty) => {
  const game = start(0, difficulty); game.invincible = true;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const first = game.bossPosition(); let previous = first, movedDuringFlight = false;
  for (let i = 0; i < yoyoPeriod(level) * 4; i++) {
    game.update(); const point = game.bossPosition();
    expect(Math.hypot(point[0] - previous[0], point[1] - previous[1])).toBeLessThan(2);
    if (i < YOYO_WARNING[level]) expect(point).toEqual(first);
    else if (Math.hypot(point[0] - first[0], point[1] - first[1]) > 10) movedDuringFlight = true;
    previous = point;
    for (const b of game.bullets.objects.filter((bullet) => bullet.active)) {
      expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x).toBeLessThanOrEqual(384);
      expect(b.y).toBeGreaterThanOrEqual(0); expect(b.y).toBeLessThanOrEqual(448);
    }
  }
  expect(movedDuringFlight).toBe(true);
  expect(game.bossPosition()).not.toEqual(first);
  expect(game.bullets.objects.filter((b) => b.active).every((b) => b.targetX === game.bossPosition()[0] && b.targetY === game.bossPosition()[1])).toBe(true);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sのキャロムは少数から段階的に増え、上限で止まる', (difficulty) => {
  const game = start(1, difficulty); game.invincible = true;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  expect(game.bullets.count).toBe(CAROM_BURST[level]);
  const original = game.bullets.objects.filter((b) => b.active);
  for (let wave = 1; wave <= 6; wave++) {
    run(game, CAROM_PERIOD[level] - 1);
    expect(game.bullets.count).toBe(Math.min(wave * CAROM_BURST[level], CAROM_CAP[level]));
    game.update();
    expect(game.bullets.count).toBe(Math.min((wave + 1) * CAROM_BURST[level], CAROM_CAP[level]));
    expect(game.bullets.objects.filter((b) => b.active).every((b) => Math.abs(b.vx) >= Math.hypot(b.vx, b.vy) * 0.3)).toBe(true);
    expect(original.every((b) => b.active)).toBe(true);
  }
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sのキャロムは四辺で反射し、速さを保って画面内に残る', (difficulty) => {
  const game = start(1, difficulty); game.invincible = true;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const ball = game.bullets.objects.find((b) => b.active)!;
  run(game, CAROM_WARNING - 2);
  for (const [x, y, vx, vy] of [[10.2, 220, -2, 0.5], [373.8, 220, 2, 0.5], [192, 10.2, 0.5, -2], [192, 437.8, 0.5, 2], [10.2, 10.2, -2, -2]]) {
    ball.x = x; ball.y = y; ball.vx = vx; ball.vy = vy; ball.grazed = true;
    const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
    game.update();
    expect(ball.vx).toBe(x < 11 || x > 373 ? -vx : vx); expect(ball.vy).toBe(y < 11 || y > 437 ? -vy : vy);
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(Math.hypot(vx, vy));
    expect(ball.grazed).toBe(false);
    expect(play).toHaveBeenCalledWith('caromTap'); play.mockRestore();
  }
  ball.vx = CAROM_SPEED[level]; ball.vy = CAROM_SPEED[level] * 0.4;
  for (let frame = 0; frame < 900; frame++) {
    game.update();
    for (const b of game.bullets.objects.filter((bullet) => bullet.active)) {
      expect(b.x).toBeGreaterThanOrEqual(10); expect(b.x).toBeLessThanOrEqual(374);
      expect(b.y).toBeGreaterThanOrEqual(10); expect(b.y).toBeLessThanOrEqual(438);
      if (b.age >= CAROM_WARNING) expect(b.delay).toBe(0);
    }
  }
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sのキャロムはボム後に少数から構え直す', (difficulty) => {
  const game = start(1, difficulty); game.invincible = true;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  run(game, CAROM_PERIOD[level] * 2);
  const old = game.bullets.objects.filter((b) => b.active);
  key('KeyX'); game.update(); game.keys.delete('KeyX');
  while (game.bombFrames > 0) game.update();
  const balls = game.bullets.objects.filter((b) => b.active);
  expect(old.every((b) => !b.active)).toBe(true);
  expect(balls).toHaveLength(CAROM_BURST[level]);
  expect(balls.every((b) => b.age === 1 && b.delay === 1)).toBe(true);
  run(game, CAROM_WARNING - 2);
  expect(balls.every((b) => b.delay === 1)).toBe(true);
  game.update(); expect(balls.every((b) => b.delay === 0)).toBe(true);
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
