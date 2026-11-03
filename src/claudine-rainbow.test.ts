import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { type Bullet, Game } from './game';
import { emitRainbow, RAINBOW_BURST_GAP, RAINBOW_COLORS, RAINBOW_INTERVAL, RAINBOW_LIMIT, RAINBOW_REVERSAL, rainbowCurvePosition, updateRainbowBullet } from './patterns/claudine-rainbow';
import type { Difficulty } from './rules';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function start(difficulty: Difficulty = 'normal', pattern = 0, cycle = 0): Game {
  const game = new Game(); game.audio.volume = 0; game.difficulty = difficulty;
  game.startStage(3); game.startBoss(false, 8);
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  for (let i = 0; i < pattern; i++) { emitRainbow(game, i * RAINBOW_INTERVAL[level]); game.bullets.clear(); }
  // 軌道を比較する代表時刻を、難易度ごとの発射フレームへ切り上げる。
  const sampleTime = 480;
  game.phaseFrame = 104 + Math.ceil(pattern * sampleTime / RAINBOW_INTERVAL[level]) * RAINBOW_INTERVAL[level] + cycle * RAINBOW_REVERSAL;
  game.invulnFrames = 0; game.invincible = true;
  return game;
}

function selectedPattern(game: Game): number {
  const bullets = game.bullets.objects.filter(b => b.active);
  if (bullets.some(b => b.releaseAt > 0)) return 2;
  return rainbowCurvePosition(bullets[0], 40) ? 1 : 0;
}

function prepareBulletReuse(game: Game, target: Bullet): void {
  // 導入でemit→clearした空きも埋め、対象の直前だけを再利用させる。
  game.bullets.objects.forEach(b => { b.active = true; });
  while (game.spawnBullet(192, 200, 0, 0, 0)) { /* プールを上限まで埋める。 */ }
  const index = game.bullets.objects.indexOf(target);
  expect(index).toBeGreaterThanOrEqual(0);
  const previous = game.bullets.objects[(index + game.bullets.objects.length - 1) % game.bullets.objects.length];
  previous.active = false;
  expect(game.spawnBullet(192, 200, 0, 0, 0)).toBe(previous);
  game.bullets.clear(); target.active = true;
}

it('最初は扇・渦巻き・蛇行を2連射ずつ出し、4回目から2連射ごとにランダムに選ぶ', () => {
  const game = start(), random = vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0.99).mockReturnValueOnce(0.01).mockReturnValueOnce(0.5);
  const selected: number[] = [];
  for (let shot = 0; shot < 7; shot++) {
    game.bullets.clear(); emitRainbow(game, shot * RAINBOW_INTERVAL[1]); selected.push(selectedPattern(game));
    expect(new Set(game.bullets.objects.filter(b => b.active).map(b => b.color)).size).toBe(RAINBOW_COLORS.length);
    expect(random).toHaveBeenCalledTimes(Math.max(0, shot - 2));
    game.bullets.clear(); emitRainbow(game, shot * RAINBOW_INTERVAL[1] + RAINBOW_BURST_GAP[1]);
    expect(selectedPattern(game)).toBe(selected[shot]);
    expect(random).toHaveBeenCalledTimes(Math.max(0, shot - 2));
  }
  expect(selected).toEqual([0, 1, 2, 2, 2, 0, 1]);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sは各パターンを2連射し、それ以外のフレームには追加しない', difficulty => {
  const game = start(difficulty), level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const spawn = vi.spyOn(game, 'spawnBullet'), random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  for (let t = 0; t <= RAINBOW_INTERVAL[level] * 5; t++) {
    game.bullets.clear(); spawn.mockClear(); emitRainbow(game, t);
    const offset = t % RAINBOW_INTERVAL[level];
    expect(spawn).toHaveBeenCalledTimes(offset === 0 || offset === RAINBOW_BURST_GAP[level] ? (level === 0 ? 28 : 42) : 0);
  }
  expect(random).toHaveBeenCalledTimes(3);
});

it('ボムで発射できなかった回は導入の順番を進めず、再戦では扇から始める', () => {
  const game = start(), interval = RAINBOW_INTERVAL[1];
  emitRainbow(game, 0); expect(selectedPattern(game)).toBe(0); game.bullets.clear();
  game.bombFrames = 1; emitRainbow(game, interval); expect(game.bullets.count).toBe(0);
  game.bombFrames = 0; emitRainbow(game, interval + RAINBOW_BURST_GAP[1]); expect(game.bullets.count).toBe(0);
  game.bombFrames = 0; emitRainbow(game, interval * 2); expect(selectedPattern(game)).toBe(1); game.bullets.clear();
  emitRainbow(game, interval * 3); expect(selectedPattern(game)).toBe(2); game.bullets.clear();
  emitRainbow(game, 0); expect(selectedPattern(game)).toBe(0);
});

it('次の種類を発射しても、それまでの弾を消さない', () => {
  const game = start(); emitRainbow(game, 0);
  const old = game.bullets.objects.filter(b => b.active);
  emitRainbow(game, RAINBOW_INTERVAL[1]);
  expect(old.every(b => b.active)).toBe(true);
  expect(game.bullets.count).toBe(84);
});

it('渦巻きは弾そのものが周回し、上下にも折り返す', () => {
  const game = start('normal', 1); game.update();
  const b = game.bullets.objects.find(b => b.active && b.color === 0 && b.gridRow === 2)!;
  let previous = Math.sign(b.vx), reversals = 0, upward = false;
  for (let age = 2; age <= 210; age++) {
    b.age = age; updateRainbowBullet(game, b);
    const direction = Math.sign(b.vx);
    if (direction !== previous) reversals++;
    previous = direction; upward ||= b.vy < -0.1;
    expect(b.active).toBe(true);
  }
  expect(reversals).toBeGreaterThanOrEqual(3); expect(upward).toBe(true);
});

it('蛇行は下降しながら左右へ繰り返し折り返し、扇とは別の軌道になる', () => {
  const fan = start(); fan.update();
  expect(rainbowCurvePosition(fan.bullets.objects.find(b => b.active)!, 40)).toBeUndefined();
  const game = start('normal', 2); game.update();
  const b = game.bullets.objects.find(b => b.active && b.color === 0 && b.gridRow === 0)!;
  let previous = Math.sign(b.vx), reversals = 0, minX = b.x, maxX = b.x;
  for (let age = 2; age <= 190; age++) {
    b.age = age; updateRainbowBullet(game, b);
    const direction = Math.sign(b.vx);
    if (direction !== previous) reversals++;
    previous = direction; minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x);
    expect(b.vy).toBeGreaterThan(0); expect(b.active).toBe(true);
  }
  expect(reversals).toBeGreaterThanOrEqual(2); expect(maxX - minX).toBeGreaterThan(30);
});

it('渦巻きのスロットを扇が再利用しても、前の曲線を引き継がない', () => {
  const game = start('normal', 1); game.update();
  const old = game.bullets.objects.find(b => b.active)!;
  expect(rainbowCurvePosition(old, 40)).toBeDefined();
  prepareBulletReuse(game, old);
  const spawn = vi.spyOn(game, 'spawnBullet');
  game.bullets.clear(); emitRainbow(game, 0);
  expect(spawn.mock.results.map(result => result.value)).toContain(old);
  expect(old.active).toBe(true); expect(old.dashWave).toBe(0);
  expect(rainbowCurvePosition(old, 40)).toBeUndefined();
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sは次の24秒で渦巻きの周回と蛇行の折り返しを反転する', difficulty => {
  function representative(section: number, cycle: number) {
    const game = start(difficulty, section, cycle); game.update();
    return game.bullets.objects.find(b => b.active && b.color === 0 && b.gridRow === 0)!;
  }
  function winding(b: ReturnType<typeof representative>) {
    const p = [90, 91, 92, 93].map(age => rainbowCurvePosition(b, age)!);
    const ax = p[2][0] - 2 * p[1][0] + p[0][0], ay = p[2][1] - 2 * p[1][1] + p[0][1];
    const bx = p[3][0] - 2 * p[2][0] + p[1][0], by = p[3][1] - 2 * p[2][1] + p[1][1];
    return ax * by - ay * bx;
  }
  // 中心の直線移動を除いた加速度の回転から、実際の周回方向を確かめる。
  expect(winding(representative(1, 0))).toBeLessThan(0);
  expect(winding(representative(1, 1))).toBeGreaterThan(0);
  const first = representative(2, 0), next = representative(2, 1);
  // 両周期の代表弾が同じ飛翔時間で左右逆向きに進むことを、座標から確認する。
  expect(rainbowCurvePosition(first, 91)![0] - rainbowCurvePosition(first, 90)![0]).toBeGreaterThan(0);
  expect(rainbowCurvePosition(next, 91)![0] - rainbowCurvePosition(next, 90)![0]).toBeLessThan(0);
});

it('蛇行のリボンが3粒の宝石弾へ分かれる', () => {
  const game = start('normal', 2); game.update();
  const parent = game.bullets.objects.find(b => b.active && b.releaseAt > 0)!;
  expect(parent).toBeDefined(); expect(parent.split).toBe(false);
  parent.age = 124;
  const spawn = vi.spyOn(game, 'spawnBullet'); game.update();
  expect(spawn).toHaveBeenCalledTimes(3);
  const children = spawn.mock.results.map(result => result.value).filter(Boolean);
  expect(children).toHaveLength(3);
  expect(children.every(b => b.dashWave === 1 && b.releaseAt === 0 && b.split === false && b.launchSoundPending === false)).toBe(true);
  expect(new Set(children.map(b => Math.atan2(b.vy, b.vx))).size).toBe(3);
  expect(game.bullets.objects.filter(b => b.active && b.gridRow < 2).every(b => b.releaseAt === 0)).toBe(true);
});

it('画面内の限度に近い分離では、同じ弾を宝石形へ変えて弾を消さない', () => {
  const game = start('normal', 2); game.update();
  const parent = game.bullets.objects.find(b => b.active && b.releaseAt > 0)!;
  while (game.bullets.count < RAINBOW_LIMIT[1]) game.spawnBullet(192, 200, 0, 0, 0);
  parent.age = 124; game.update();
  expect(parent.active).toBe(true); expect(parent.dashWave).toBe(1); expect(parent.releaseAt).toBe(0);
});

it('ボム中には追加射撃と分離を出さず、次の技へ虹を持ち越さない', () => {
  const game = start('normal', 2);
  for (let frame = 0; frame < 200; frame++) game.update();
  expect(game.bullets.count).toBeGreaterThan(0);
  game.bombFrames = 150;
  const spawn = vi.spyOn(game, 'spawnBullet');
  for (let frame = 0; frame < 120; frame++) game.update();
  expect(game.bullets.count).toBe(0); expect(spawn).not.toHaveBeenCalled();
  game.bombFrames = 0;
  for (let frame = 0; frame < 160; frame++) game.update();
  expect(game.bullets.count).toBeGreaterThan(0);
  game.phaseHp = 0; game.update();
  expect(game.bullets.count).toBe(0);
});

it('技の開始前とボム中には虹を生成しない', () => {
  const game = start(); emitRainbow(game, -1);
  expect(game.bullets.count).toBe(0);
  game.bombFrames = 1; emitRainbow(game, 0);
  expect(game.bullets.count).toBe(0);
});

it('親のスロットを分離弾が再利用しても、宝石弾が再分裂しない', () => {
  const game = start('normal', 2); game.update();
  const parent = game.bullets.objects.find(b => b.active && b.releaseAt > 0)!;
  prepareBulletReuse(game, parent);
  parent.age = 124;
  const spawn = vi.spyOn(game, 'spawnBullet'); game.update();
  const children = spawn.mock.results.map(result => result.value).filter(Boolean);
  expect(children).toHaveLength(3); expect(children).toContain(parent);
  expect(children.every(b => b.active && b.dashWave === 1 && b.releaseAt === 0 && b.split === false)).toBe(true);
  expect(children.every(b => rainbowCurvePosition(b, b.age + 40) === undefined)).toBe(true);
});

it('分離弾は生成フレームに当たらず、翌フレームから通常の当たり判定を持つ', () => {
  const game = start('normal', 2); game.update();
  const parent = game.bullets.objects.find(b => b.active && b.releaseAt > 0)!;
  game.bullets.forEach(b => { if (b !== parent) b.active = false; });
  const position = rainbowCurvePosition(parent, 125)!;
  game.px = position[0]; game.py = position[1]; parent.age = 124;
  game.invincible = false; game.invulnFrames = 0;
  game.update(); expect(game.pendingHit).toBe(-1);
  game.update(); expect(game.pendingHit).toBeGreaterThanOrEqual(0);
});
