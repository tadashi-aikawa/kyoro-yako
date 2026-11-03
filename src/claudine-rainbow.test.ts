import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { emitRainbow, RAINBOW_COLORS, RAINBOW_LIMIT, RAINBOW_SECTION, rainbowSection } from './patterns/claudine-rainbow';
import { bulletContact, type Difficulty, FIELD } from './rules';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => vi.unstubAllGlobals());

function start(difficulty: Difficulty = 'normal', t = 0): Game {
  const game = new Game(); game.audio.volume = 0; game.difficulty = difficulty;
  game.startStage(3); game.startBoss(false, 8); game.phaseFrame = 104 + t;
  game.invulnFrames = 0; game.invincible = true;
  return game;
}

it('8秒ごとに扇・交差・分離へ進み、次の24秒では向きを反転する', () => {
  const fan = start(); fan.update();
  expect(fan.phase?.name).toBe('レインボー・ヴェール');
  const first = fan.bullets.objects.filter(b => b.active);
  expect(first).toHaveLength(42);
  expect(new Set(first.map(b => b.color)).size).toBe(RAINBOW_COLORS.length);
  expect(new Set(first.map(b => b.gridRow)).size).toBe(3);
  const cross = start('normal', RAINBOW_SECTION); cross.update();
  const xs = cross.bullets.objects.filter(b => b.active).map(b => b.x);
  expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(120);
  const next = start('normal', RAINBOW_SECTION * 3); next.update();
  expect(next.bullets.objects.find(b => b.active)!.spin).toBe(-first[0].spin);
  expect([0, 479, 480, 959, 960, 1439, 1440].map(rainbowSection)).toEqual([0, 0, 1, 1, 2, 2, 0]);
});

it('場面を切り替えても飛んでいる虹を残し、交差する流れを重ねる', () => {
  const game = start();
  for (let frame = 0; frame < 480; frame++) game.update();
  const old = game.bullets.objects.filter(b => b.active);
  const ages = old.map(b => b.age);
  const spawn = vi.spyOn(game, 'spawnBullet'); game.update();
  expect(old.filter((b, i) => b.active && b.age > ages[i]).length).toBeGreaterThan(200);
  expect(spawn).toHaveBeenCalledTimes(42);
});

it('第3区間のリボンが3粒の宝石弾へ分かれる', () => {
  const game = start('normal', 972); game.update();
  const parent = game.bullets.objects.find(b => b.active && b.releaseAt > 0)!;
  expect(parent).toBeDefined(); expect(parent.split).toBe(false);
  parent.age = 124;
  const spawn = vi.spyOn(game, 'spawnBullet'); game.update();
  expect(spawn).toHaveBeenCalledTimes(3);
  const children = spawn.mock.results.map(result => result.value).filter(Boolean);
  expect(children).toHaveLength(3);
  expect(children.every(b => b.dashWave === 1 && b.releaseAt === 0 && b.split === false && b.launchSoundPending === false)).toBe(true);
  expect(new Set(children.map(b => Math.atan2(b.vy, b.vx))).size).toBe(3);
});

it('画面内の限度に近い分離では、同じ弾を宝石形へ変えて弾を消さない', () => {
  const game = start('normal', 972); game.update();
  const parent = game.bullets.objects.find(b => b.active && b.releaseAt > 0)!;
  while (game.bullets.count < RAINBOW_LIMIT[1]) game.spawnBullet(192, 200, 0, 0, 0);
  parent.age = 124; game.update();
  expect(parent.active).toBe(true); expect(parent.dashWave).toBe(1); expect(parent.releaseAt).toBe(0);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sで60秒近く進めても弾プールは飽和せず、全3区間に弾幕が続く', difficulty => {
  const game = start(difficulty), spawn = vi.spyOn(game, 'spawnBullet');
  let peak = 0; const kinds = new Set<number>(), colors = new Set<number>();
  const coverage = new Set<number>(); const sections = [0, 0, 0];
  for (let frame = 0; frame < 3450; frame++) {
    game.update(); const count = game.bullets.count; peak = Math.max(peak, count);
    if (frame >= 240) sections[rainbowSection(frame)] = Math.max(sections[rainbowSection(frame)], count);
    game.bullets.forEach(b => {
      if (b.motion !== 'rainbowVeil') return;
      kinds.add(b.dashWave); colors.add(b.color);
      if (b.delay > 0 || Math.abs(b.y - (FIELD.h - 9)) > 5) return;
      for (let x = Math.max(9, Math.ceil(b.x - 5)); x <= Math.min(FIELD.w - 9, Math.floor(b.x + 5)); x++) {
        if (bulletContact(x, FIELD.h - 9, b.x, b.y, b.radius, false) === 'hit') coverage.add(x);
      }
    });
  }
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  expect(peak).toBeGreaterThan(500); expect(peak).toBeLessThanOrEqual(RAINBOW_LIMIT[level]);
  expect(sections.every(count => count > 300)).toBe(true);
  expect([...kinds].sort()).toEqual([0, 1]); expect(colors.size).toBe(7);
  expect(spawn.mock.results.every(result => result.value !== undefined)).toBe(true);
  expect(coverage.size).toBe(FIELD.w - 17);
});

it('中央で待つだけでは当たり、固定の安全な穴はない', () => {
  const game = start(); game.invincible = false;
  for (let frame = 0; frame < 900 && game.pendingHit < 0; frame++) game.update();
  expect(game.pendingHit).toBeGreaterThanOrEqual(0);
});

it('ボム中には追加射撃と分離を出さず、次の技へ虹を持ち越さない', () => {
  const game = start('normal', 972);
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
  const game = start('normal', 972); game.update();
  const parent = game.bullets.objects.find(b => b.active && b.releaseAt > 0)!;
  while (game.bullets.objects.length < 2600) game.spawnBullet(192, 200, 0, 0, 0);
  game.bullets.forEach(b => { if (b !== parent) b.active = false; });
  parent.age = 124;
  const spawn = vi.spyOn(game, 'spawnBullet'); game.update();
  const children = spawn.mock.results.map(result => result.value).filter(Boolean);
  expect(children).toHaveLength(3); expect(children).toContain(parent);
  expect(children.every(b => b.active && b.dashWave === 1 && b.releaseAt === 0 && b.split === false)).toBe(true);
});

it('分離弾は生成フレームに当たらず、翌フレームから通常の当たり判定を持つ', () => {
  const game = start('normal', 972); game.update();
  const parent = game.bullets.objects.find(b => b.active && b.releaseAt > 0)!;
  game.bullets.forEach(b => { if (b !== parent) b.active = false; });
  parent.x = game.px = 192; parent.y = game.py = 300;
  parent.vx = 0; parent.vy = 0; parent.spin = 0; parent.sway = 0; parent.age = 124;
  game.invincible = false; game.invulnFrames = 0;
  game.update(); expect(game.pendingHit).toBe(-1);
  game.update(); expect(game.pendingHit).toBeGreaterThanOrEqual(0);
});
