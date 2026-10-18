import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { safeLanesAtY } from './bullet-lanes.test-support';
import { type Bullet, Game } from './game';
import { emitBossNormal, normalPeriod } from './patterns/boss-normal';
import { bulletContact, bulletSpeed, type Difficulty } from './rules';
import { STAGES } from './stages';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function start(stage: number, index = 0, difficulty: Difficulty = 'normal'): Game {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.difficulty = difficulty; game.startStage(stage); game.startBoss(false, index);
  return game;
}
const active = (game: Game) => game.bullets.objects.filter((b) => b.active);
const velocity = (b: Bullet) => Math.hypot(b.vx, b.vy);
const cases = STAGES.flatMap((stage, s) => stage.phases.flatMap((phase, index) =>
  phase.kind === 'normal' && index <= 2 ? [{ stage: s + 1, index, pattern: phase.pattern }] : []));

function waves(game: Game, limit = 24) {
  const result: { t: number; centerX: number; centerY: number; bullets: Bullet[] }[] = [];
  for (let t = 0; t < game.phase!.duration * 60 - 105 && result.length < limit; t++) {
    game.bullets.clear(); game.phaseFrame = 105 + t;
    emitBossNormal(game, game.phase!.pattern, t);
    const bullets = active(game).map((b) => ({ ...b }));
    const [centerX, centerY] = game.bossPosition();
    if (bullets.length) result.push({ t, centerX, centerY, bullets });
  }
  expect(result).toHaveLength(limit);
  return result;
}

function passableLane(bullets: Bullet[]): number {
  const lanes = safeLanesAtY(bullets, 400);
  const lane = lanes.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
  expect(lane, '斉射を通り抜けられる安全区間を残す').toBeDefined();
  expect(lane[1] - lane[0]).toBeGreaterThanOrEqual(14);
  for (const px of [lane[0] + 0.01, (lane[0] + lane[1]) / 2, lane[1] - 0.01]) {
    for (const b of bullets) {
      const time = Math.max(0, ((px - b.x) * b.vx + (400 - b.y) * b.vy) / (b.vx ** 2 + b.vy ** 2));
      expect(bulletContact(px, 400, b.x + b.vx * time, b.y + b.vy * time, b.radius, false)).not.toBe('hit');
    }
  }
  return lane[1] - lane[0];
}

it('5体それぞれに専用の通常攻撃を2種類持つ', () => {
  const patterns = STAGES.flatMap((stage) => [...new Set(stage.phases.filter((p) => p.kind === 'normal').map((p) => p.pattern))]);
  expect(patterns).toHaveLength(10); expect(new Set(patterns).size).toBe(10);
});

it.each(cases)('$patternは全難易度で発射し、弾数・弾速が段階的に増える', ({ stage, index }) => {
  const samples = (['easy', 'normal', 'hard', 'lunatic'] as const).map((difficulty) => {
    const game = start(stage, index, difficulty);
    const spawn = vi.spyOn(game, 'spawnBullet');
    let maxSpeed = 0; let peak = 0;
    for (let i = 0; i < 840; i++) {
      game.update();
      for (const b of active(game)) maxSpeed = Math.max(maxSpeed, velocity(b));
      peak = Math.max(peak, game.bullets.count);
    }
    expect(game.phase?.kind).toBe('normal'); expect(peak).toBeLessThan(700);
    return { count: spawn.mock.calls.length, maxSpeed };
  });
  expect(samples[0].count).toBeGreaterThan(0);
  for (let i = 1; i < samples.length; i++) {
    expect(samples[i].count).toBeGreaterThan(samples[i - 1].count);
    expect(samples[i].maxSpeed).toBeGreaterThan(samples[i - 1].maxSpeed);
  }
});

it.each(cases)('$patternは全難易度・各斉射でy=400に14px以上の安全区間を残す', ({ stage, index }) => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    for (const { bullets } of waves(start(stage, index, difficulty))) passableLane(bullets);
  }
});

it.each(cases)('$patternの弾は停止・再照準・加速をせず直進する', ({ stage, index }) => {
  const game = start(stage, index); game.phaseFrame = 104; game.update();
  const bullets = active(game).map((b) => ({ bullet: b, x: b.x, y: b.y, vx: b.vx, vy: b.vy }));
  expect(bullets.length).toBeGreaterThan(0);
  expect(bullets.every(({ bullet: b }) => b.motion === 'normal' && b.delay === 0)).toBe(true);
  game.px = 50;
  for (let frame = 0; frame < 12; frame++) game.update();
  for (const { bullet: b, x, y, vx, vy } of bullets) {
    expect([b.vx, b.vy]).toEqual([vx, vy]);
    if (b.active) { expect(b.x).toBeCloseTo(x + vx * 12); expect(b.y).toBeCloseTo(y + vy * 12); }
  }
});

it.each([0, 2])('ネオ通常%dは自機狙いと下向きの扇を交互に撃ち、短い連打を重ねない', (index) => {
  const emitted = waves(start(1, index), 6);
  expect(emitted.map((wave) => wave.bullets[0].kind)).toEqual(['needle', 'star', 'needle', 'star', 'needle', 'star']);
  for (let i = 1; i < emitted.length; i++) expect(emitted[i].t - emitted[i - 1].t).toBeGreaterThanOrEqual(60);
  expect(emitted.every((wave) => wave.bullets.every((b) => b.x === wave.centerX && b.y === wave.centerY && b.vy > 0))).toBe(true);
});

it.each([0, 2])('オブシディア通常%dは通れる弾間の横列を左右交互に重ねる', (index) => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    const emitted = waves(start(2, index, difficulty));
    for (const { bullets } of emitted) {
      expect(new Set(bullets.map((b) => b.y)).size).toBe(1);
      expect(new Set(bullets.map((b) => b.vx)).size).toBe(1);
      expect(bullets.every((b) => b.kind === 'glyph' && b.vy > 0)).toBe(true);
      const sorted = bullets.sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].x - sorted[i - 1].x;
        const occupied = 2 * (sorted[i].radius + 2.5) * velocity(sorted[i]) / sorted[i].vy;
        expect(gap - occupied).toBeGreaterThanOrEqual(14);
      }
    }
    expect(emitted[0].bullets[0].vx * emitted[1].bullets[0].vx).toBeLessThan(0);
    expect(emitted[0].bullets[0].color).not.toBe(emitted[1].bullets[0].color);
  }
});

it.each([0, 2])('クロディーヌ通常%dは均等な弾間の左右対称アーク・リングを2色交互に出す', (index) => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    const emitted = waves(start(3, index, difficulty));
    for (const { bullets } of emitted) {
      for (const b of bullets) expect(bullets.some((mirror) => Math.abs(mirror.vx + b.vx) < 0.001 && Math.abs(mirror.vy - b.vy) < 0.001)).toBe(true);
      expect(new Set(bullets.map((b) => b.color)).size).toBe(1);
      const angles = bullets.map((b) => Math.atan2(b.vy, b.vx)).sort((a, b) => a - b);
      const spacings = angles.slice(1).map((a, i) => a - angles[i]);
      expect(Math.max(...spacings) - Math.min(...spacings)).toBeLessThan(0.001);
    }
    expect(emitted[0].bullets[0].color).not.toBe(emitted[1].bullets[0].color);
  }
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('迅雷は高速を維持して他4体より速く、ボス位置からの自機狙いは1周期1回: %s', (difficulty) => {
  for (const index of [0, 2]) {
    const game = start(4, index, difficulty);
    const beat = normalPeriod(game, index === 0 ? 84 : 96);
    const emitted = waves(game, 10).filter((wave) => wave.t < beat);
    const fastSpeed = velocity(emitted[0].bullets[0]);
    expect(fastSpeed).toBeCloseTo(bulletSpeed(difficulty, 5.1));
    let aimed = 0;
    for (const { bullets, centerX, centerY } of emitted) {
      expect(bullets.every((b) => b.x === centerX && b.y === centerY && b.kind === 'needle' && b.delay === 0)).toBe(true);
      if (bullets.every((b) => b.vy > 0)) aimed++;
    }
    expect(aimed).toBe(1);
    for (const stage of [1, 2, 3, 5]) {
      const main = waves(start(stage, 0, difficulty), 1)[0].bullets;
      expect(fastSpeed).toBeGreaterThan(Math.max(...main.map(velocity)));
    }
  }
});

it.each(cases.filter(({ stage }) => stage !== 1 && stage !== 4))('$patternの弾速は全難易度で旧版相当の1.6〜1.7×unitに収まる', ({ stage, index }) => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    for (const { bullets } of waves(start(stage, index, difficulty))) for (const b of bullets) {
      expect(velocity(b)).toBeGreaterThanOrEqual(bulletSpeed(difficulty, 1.6) - 0.00001);
      expect(velocity(b)).toBeLessThanOrEqual(bulletSpeed(difficulty, 1.7) + 0.00001);
    }
  }
});

it.each([0, 2])('ネオ通常%dは全難易度で1.35×unit以下へ減速する', (index) => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    for (const { bullets } of waves(start(1, index, difficulty))) for (const b of bullets) {
      expect(velocity(b)).toBeLessThanOrEqual(bulletSpeed(difficulty, 1.35) + 0.00001);
    }
  }
});

it.each([0, 2])('ネオ通常%dは全難易度で自機を狙う中央の弾を残す', (index) => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    const game = start(1, index, difficulty); game.px = 280;
    const { bullets, centerX, centerY } = waves(game, 1)[0];
    expect(bullets.length % 2).toBe(1);
    expect(bullets.some((b) => Math.abs(b.vx * (game.py - centerY) - b.vy * (game.px - centerX)) < 0.00001)).toBe(true);
  }
});

it.each(cases)('$patternはボス至近でも斉射を減らさない', ({ stage, index }) => {
  const near = start(stage, index); const far = start(stage, index);
  let volleys = 0;
  for (let t = 0; t < 600; t++) {
    near.bullets.clear(); far.bullets.clear();
    near.phaseFrame = far.phaseFrame = 105 + t;
    const [x, y] = near.bossPosition();
    near.px = x; near.py = y + (stage === 2 ? 10 : stage === 4 ? 100 : 65);
    emitBossNormal(near, near.phase!.pattern, t); emitBossNormal(far, far.phase!.pattern, t);
    const reference = active(far);
    if (!reference.length) continue;
    expect(active(near)).toHaveLength(reference.length);
    volleys++;
  }
  expect(volleys).toBeGreaterThan(0);
});

it.each(cases.filter(({ stage }) => stage === 2))('$patternの上端の列弾は自機の位置によらず画面外から全弾発射する', ({ stage, index }) => {
  const game = start(stage, index);
  const row = waves(game).find((wave) => wave.bullets.every((b) => b.y === -8))!;
  expect(row).toBeDefined();
  const origin = row.bullets[Math.floor(row.bullets.length / 2)];
  game.px = origin.x; game.py = 12; game.phaseFrame = 105 + row.t;
  game.bullets.clear(); emitBossNormal(game, game.phase!.pattern, row.t);
  expect(active(game)).toHaveLength(row.bullets.length);
  expect(active(game).every((b) => b.y === -8 && b.y + b.radius < 0 && b.vy > 0)).toBe(true);
});

it.each([0, 2].flatMap((index) => [10, 20].map((offset) => ({ index, offset }))))('オブシディア通常$indexはボス直下$offset pxでも被弾しうる', ({ index, offset }) => {
  const game = start(2, index); game.invincible = false; game.invulnFrames = 0;
  for (let frame = 1; frame <= 600; frame++) {
    const [x, y] = game.bossPosition();
    game.px = x; game.py = y + offset;
    game.update();
    if (game.pendingHit >= 0) return;
  }
  expect.fail('ボス直下に600フレーム留まっても被弾しない');
});

it.each([0, 2])('ミネルヴァ通常%dは現在位置への星弾の扇とリングを交互に重ねる', (index) => {
  const aim = (px: number) => {
    const game = start(5, index); game.px = px;
    return waves(game, 1)[0];
  };
  const center = aim(192); const right = aim(300);
  const direction = (bullets: Bullet[]) => Math.atan2(bullets.reduce((sum, b) => sum + b.vy, 0), bullets.reduce((sum, b) => sum + b.vx, 0));
  expect(direction(right.bullets)).toBeLessThan(direction(center.bullets));
  const emitted = waves(start(5, index), 2);
  expect(emitted.every((w) => w.bullets.every((b) => b.kind === 'star'))).toBe(true);
  expect(emitted[0].bullets.every((b) => b.vy > 0)).toBe(true);
  expect(emitted[1].bullets.some((b) => b.vy < 0)).toBe(true);
});

it.each([0, 2])('Easyのミネルヴァ通常%dの通過量は旧通常攻撃の最大値173.9を超えない', (index) => {
  // 173.9は旧ミネルヴァ通常2のEasy実測値。最終面の増弾をEasyへ過剰に持ち込まないための面固有の上限。
  const game = start(5, index, 'easy');
  let total = 0; let samples = 0;
  for (let frame = 1; frame <= 1800; frame++) {
    game.update();
    if (frame <= 400 || frame % 60 !== 0) continue;
    total += active(game).filter((b) => b.delay === 0 && b.x >= 0 && b.x <= 384 && b.y >= 0 && b.y <= 448).reduce((sum, b) => sum + velocity(b), 0);
    samples++;
  }
  expect(total / samples).toBeLessThanOrEqual(173.9);
});

it('Normalではミネルヴァの両通常攻撃が他4体より最低2割高密度になる', () => {
  const samples = cases.map(({ stage, index }) => {
    const game = start(stage, index); let total = 0;
    for (let frame = 1; frame <= 1800; frame++) {
      game.update();
      if (frame <= 400 || frame % 60 !== 0) continue;
      total += active(game).filter((b) => b.x >= 0 && b.x <= 384 && b.y >= 0 && b.y <= 448).length;
    }
    return { stage, total };
  });
  const others = samples.filter((s) => s.stage < 5).map((s) => s.total);
  for (const minerva of samples.filter((s) => s.stage === 5)) expect(minerva.total).toBeGreaterThan(Math.max(...others) * 1.2);
});
