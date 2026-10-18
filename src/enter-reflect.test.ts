import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game, type Shot } from './game';
import { ENTER_REFLECT_COOLDOWN, reflectEnterShot } from './patterns/enter-reflect';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => vi.unstubAllGlobals());
function start(): Game {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(1); game.startBoss(false, 6); return game;
}
function letter(game: Game, x = 192, y = 220) {
  const b = game.spawnBullet(x, y, 0, 1.4, 1, 'glyph')!;
  b.motion = 'enterLine'; b.gridColumn = 0; return b;
}
const shot = (x = 190, y = 200, vx = 0): Shot => ({ active: true, x, y, vx, vy: -10.5, radius: 3, damage: 1.35, homing: false });
const reflected = (game: Game) => game.bullets.objects.filter((b) => b.active && b.kind === 'needle');

it('発射済みの文字弾はショットを斜め下へ返す', () => {
  const game = start(), glyph = letter(game);
  const s = shot(); expect(reflectEnterShot(game, s, 190, 240, [glyph])).toBe(true);
  expect(s.active).toBe(false); expect(glyph.active).toBe(true);
  const back = reflected(game); expect(back).toHaveLength(1);
  expect(back[0].vx).toBeLessThan(0); expect(back[0].vy).toBeGreaterThan(0);
  expect(Math.abs(back[0].vx)).toBeCloseTo(back[0].vy);
  expect(back[0].fadeAt).toBe(210);
});

it('高速ショットが文字を飛び越えても、最初に触れる文字で1回だけ反射する', () => {
  const game = start(), far = letter(game, 192, 180), near = letter(game, 192, 280);
  const s = shot(192, 100, 0);
  expect(reflectEnterShot(game, s, 192, 330, [far, near])).toBe(true);
  expect(reflected(game)).toHaveLength(1); expect(reflected(game)[0].y).toBe(280);
});

it('文字のない隙間を通ったショットは止めない', () => {
  const game = start(), glyph = letter(game, 100), s = shot(192);
  expect(reflectEnterShot(game, s, 192, 240, [glyph])).toBe(false);
  expect(s.active).toBe(true); expect(reflected(game)).toHaveLength(0);
});

it('同じ文字への同時ショットはすべて止め、反射弾の増殖を抑える', () => {
  const game = start(), glyph = letter(game);
  for (let i = 0; i < 6; i++) {
    const s = shot(); expect(reflectEnterShot(game, s, 190, 240, [glyph])).toBe(true); expect(s.active).toBe(false);
  }
  expect(reflected(game)).toHaveLength(1);
  glyph.age += ENTER_REFLECT_COOLDOWN[1];
  expect(reflectEnterShot(game, shot(), 190, 240, [glyph])).toBe(true);
  expect(reflected(game)).toHaveLength(2);
});

it('別の技とボム中には反射せず、消えた文字も判定しない', () => {
  const game = start(), glyph = letter(game);
  game.bombFrames = 10;
  expect(reflectEnterShot(game, shot(), 190, 240, [glyph])).toBe(false);
  game.bombFrames = 0; glyph.active = false;
  expect(reflectEnterShot(game, shot(), 190, 240, [glyph])).toBe(false);
  game.startBoss(false, 1); glyph.active = true;
  expect(reflectEnterShot(game, shot(), 190, 240, [glyph])).toBe(false);
});

it('文字で止めたショットは同じフレームでネオへダメージを通さない', () => {
  const game = start(); game.phaseFrame = 104;
  const [x, y] = game.bossPosition(); letter(game, x, y + 20);
  const s = game.shots.acquire()!;
  Object.assign(s, shot(x, y + 32), { vy: -32 });
  const hp = game.phaseHp; game.update();
  expect(s.active).toBe(false); expect(game.phaseHp).toBe(hp); expect(reflected(game)).toHaveLength(1);
});

it('文字の隙間から撃ったショットはネオに届く', () => {
  const game = start(); game.phaseFrame = 104;
  const [x, y] = game.bossPosition(); letter(game, x + 40, y + 20);
  const s = game.shots.acquire()!;
  Object.assign(s, shot(x, y + 12), { vy: -12 });
  const hp = game.phaseHp; game.update();
  expect(game.phaseHp).toBeCloseTo(hp - s.damage); expect(reflected(game)).toHaveLength(0);
});

it.each([1, 60])('残り%dフレームの予告文字はショットを通し、ネオへダメージを与えられる', (delay) => {
  const game = start(); game.phaseFrame = 104;
  const [x, y] = game.bossPosition(), glyph = letter(game, x, y + 20); glyph.delay = delay;
  const s = game.shots.acquire()!; Object.assign(s, shot(x, y + 32), { vy: -32 });
  const hp = game.phaseHp; game.update();
  expect(game.phaseHp).toBeCloseTo(hp - s.damage); expect(reflected(game)).toHaveLength(0);
  glyph.delay = delay;
  const direct = shot(x, y); expect(reflectEnterShot(game, direct, x, y + 32, [glyph])).toBe(false); expect(direct.active).toBe(true);
});

it('反射弾は自機へ当たり、ボムと技切替では消える', () => {
  const game = start(), glyph = letter(game);
  reflectEnterShot(game, shot(), 190, 240, [glyph]);
  const back = reflected(game)[0]; glyph.active = false;
  game.px = back.x + back.vx; game.py = back.y + back.vy; game.invincible = false; game.invulnFrames = 0;
  game.update(); expect(game.pendingHit).toBeGreaterThanOrEqual(0);
  game.invincible = true; game.pendingHit = -1; game.bombFrames = 2; game.update();
  expect(reflected(game)).toHaveLength(0);
  game.bombFrames = 0; const next = letter(game); reflectEnterShot(game, shot(), 190, 240, [next]);
  expect(reflected(game)).toHaveLength(1); game.skipPhase(); expect(reflected(game)).toHaveLength(0);
});

it('ポーズ中は文字の反射間隔も止まる', () => {
  const game = start(), glyph = letter(game); reflectEnterShot(game, shot(), 190, 240, [glyph]);
  game.scene = 'pause'; for (let i = 0; i < 40; i++) game.update();
  expect(glyph.age).toBe(0);
  reflectEnterShot(game, shot(), 190, 240, [glyph]); expect(reflected(game)).toHaveLength(1);
});

it('Easyほど連射から生まれる反射弾を減らし、反射でネオを構えさせない', () => {
  const counts: number[] = [];
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    const game = start(); game.difficulty = difficulty; const glyph = letter(game);
    for (let age = 0; age < 210; age++) { glyph.age = age; reflectEnterShot(game, shot(), 190, 240, [glyph]); }
    const shots = reflected(game); counts.push(shots.length);
    expect(shots.every((b) => !b.launchSoundPending)).toBe(true);
  }
  expect(counts).toEqual([7, 10, 14, 18]);
});
