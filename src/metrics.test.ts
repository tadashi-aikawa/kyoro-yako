import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { measureBulletDensity } from './bullet-lanes.test-support';
import { Game } from './game';
import { Renderer } from './render';

// 出所: HEAD ac9c2443ef65c59656088027d8cae789b4b81399 のgateFan / fan / dawnFanをNormalで実測。
// 420〜1800fを60f間隔で24点採取した各面の最初の通常攻撃。承認された小数1桁の値を上限に使う。
const LEGACY_NORMAL_DENSITY = [
  { count: 118.2, traffic: 89.0 },
  { count: 191.5, traffic: 205.4 },
  { count: 191.5, traffic: 205.4 },
  { count: 191.5, traffic: 205.4 },
  { count: 261.0, traffic: 292.9 },
] as const;

function visibleBullets(game: Game): number {
  let count = 0;
  game.bullets.forEach((bullet) => {
    if (bullet.x >= 0 && bullet.x <= 384 && bullet.y >= 0 && bullet.y <= 448) count++;
  });
  return count;
}

function bulletTraffic(game: Game): number {
  let traffic = 0;
  game.bullets.forEach((b) => {
    if (b.delay === 0 && b.x >= 0 && b.x <= 384 && b.y >= 0 && b.y <= 448) traffic += Math.hypot(b.vx, b.vy);
  });
  return traffic;
}

beforeAll(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterAll(() => vi.unstubAllGlobals());

it('全5面に10種の編隊が登場し、上部の滞在と道中の密度を保つ', () => {
  let previousAverage = 0;
  for (const stage of [1, 2, 3, 4, 5]) {
    const game = new Game();
    game.audio.volume = 0;
    game.invincible = true;
    game.startStage(stage);
    const counts: number[] = [];
    const earlyCounts: number[] = [];
    // 迅雷だけは高速弾で滞在時間が短いため、予告中を除いた弾速込みの通過量を比較する。
    const bossMetric = stage === 4 ? bulletTraffic : visibleBullets;
    const kinds = new Set<string>();
    let maxEnemies = 0;
    let maxEnemyY = 0;
    while (game.stageFrame < 4800) {
      game.update();
      game.enemies.forEach((enemy) => { kinds.add(enemy.kind); maxEnemyY = Math.max(maxEnemyY, enemy.y); });
      maxEnemies = Math.max(maxEnemies, game.enemies.count);
      if (game.stageFrame > 400 && game.stageFrame % 60 === 0) {
        counts.push(visibleBullets(game));
        if (game.stageFrame <= 1800) earlyCounts.push(bossMetric(game));
      }
      if (game.scene === 'dialogue') {
        game.stageFrame = 2650;
        game.scene = 'stage';
        game.boss = undefined;
      }
    }
    expect(kinds.size, `stage ${stage}`).toBe(10);
    expect(maxEnemies).toBeLessThanOrEqual(18);
    expect(maxEnemyY).toBeLessThan(260);
    const average = (samples: number[]) => samples.reduce((sum, value) => sum + value, 0) / samples.length;
    // 編隊ごとに疎密を作るため、特定の3フレームではなく道中全体で検査する。
    const [low, high, peak] = [[25, 65, 90], [30, 65, 95], [50, 95, 145], [65, 120, 185], [75, 140, 210]][stage - 1];
    expect(average(counts)).toBeGreaterThanOrEqual(low);
    expect(average(counts)).toBeLessThanOrEqual(high);
    expect(Math.max(...counts)).toBeLessThanOrEqual(peak);
    for (const phase of [0, 2]) {
      const boss = new Game(); boss.audio.volume = 0; boss.invincible = true;
      boss.startStage(stage); boss.startBoss(false, phase);
      const bossCounts: number[] = [];
      for (let frame = 1; frame <= 1800; frame++) {
        boss.update();
        if (frame > 400 && frame % 60 === 0) bossCounts.push(bossMetric(boss));
      }
      const margin = stage === 1 && phase === 2 ? 1.05 : 1;
      expect(average(bossCounts), `stage ${stage} phase ${phase}: 通常攻撃は道中の1.1倍以上、ネオ通常2は下限に5%以上の余裕`).toBeGreaterThanOrEqual(average(earlyCounts) * 1.1 * margin);
    }
    expect(average(counts)).toBeGreaterThan(previousAverage);
    previousAverage = average(counts);
  }
});

it.each([1, 2, 3, 4, 5])('%d面の両通常攻撃はNormalの弾数・通過量とも旧版以下に収まる', (stage) => {
  for (const phase of [0, 2]) {
    const game = new Game(); game.audio.volume = 0; game.invincible = true;
    game.startStage(stage); game.startBoss(false, phase);
    const measured = measureBulletDensity(game);
    const limit = LEGACY_NORMAL_DENSITY[stage - 1];
    expect(measured.count, game.phase?.pattern).toBeLessThanOrEqual(limit.count);
    expect(measured.traffic, game.phase?.pattern).toBeLessThanOrEqual(limit.traffic);
  }
});

it('SDスプライトがない場合はフィールドにstand画像を描く', () => {
  const game = new Game();
  const stand = { complete: true, naturalWidth: 640, naturalHeight: 960 } as HTMLImageElement;
  game.images['neo-stand'] = stand;
  const drawImage = vi.fn();
  const context = { save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {}, drawImage } as unknown as CanvasRenderingContext2D;
  const renderer = Object.create(Renderer.prototype) as Renderer;
  Object.defineProperty(renderer, 'ctx', { value: context });
  Reflect.apply(Reflect.get(renderer, 'fieldCharacter'), renderer, [game, 'neo', 192, 398, 40, 0]);
  expect(drawImage).toHaveBeenCalledOnce();
  expect(drawImage.mock.calls[0][0]).toBe(stand);
  expect(drawImage.mock.calls[0][4]).toBe(40);
});

it('高難度の道中でも弾プールを飽和させない', () => {
  for (const stage of [1, 2, 3, 4, 5]) {
    const game = new Game(); game.audio.volume = 0; game.invincible = true;
    game.difficulty = 'lunatic'; game.startStage(stage);
    let max = 0;
    while (game.stageFrame < 4800) {
      game.update(); max = Math.max(max, game.bullets.count);
      if (game.scene === 'dialogue') { game.stageFrame = 2650; game.scene = 'stage'; game.boss = undefined; }
    }
    expect(max, `stage ${stage}`).toBeLessThan(500);
  }
});

it('3面の高難度スペルを進めても弾プールが飽和しない', () => {
  for (const phase of [1, 3, 5, 7, 8, 9]) {
    const game = new Game(); game.audio.volume = 0; game.invincible = true;
    game.difficulty = 'lunatic'; game.startStage(3); game.startBoss(false, phase);
    let max = 0;
    for (let frame = 0; frame < 1800; frame++) {
      game.update();
      max = Math.max(max, game.bullets.count);
    }
    expect(max, `phase ${phase}`).toBeLessThan(1000);
  }
});
