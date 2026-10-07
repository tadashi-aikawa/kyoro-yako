import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Game } from './game';
import { Renderer } from './render';

function visibleBullets(game: Game): number {
  let count = 0;
  game.bullets.forEach((bullet) => {
    if (bullet.x >= 0 && bullet.x <= 384 && bullet.y >= 0 && bullet.y <= 448) count++;
  });
  return count;
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
    const kinds = new Set<string>();
    let maxEnemies = 0;
    let maxEnemyY = 0;
    while (game.stageFrame < 4800) {
      game.update();
      game.enemies.forEach((enemy) => { kinds.add(enemy.kind); maxEnemyY = Math.max(maxEnemyY, enemy.y); });
      maxEnemies = Math.max(maxEnemies, game.enemies.count);
      if (game.stageFrame > 400 && game.stageFrame % 60 === 0) {
        counts.push(visibleBullets(game));
        if (game.stageFrame <= 1800) earlyCounts.push(visibleBullets(game));
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
    const boss = new Game();
    boss.audio.volume = 0;
    boss.invincible = true;
    boss.startStage(stage);
    boss.startBoss(false, 0);
    const bossCounts: number[] = [];
    for (let frame = 1; frame <= 1800; frame++) {
      boss.update();
      if (frame > 400 && frame % 60 === 0) bossCounts.push(visibleBullets(boss));
    }
    const average = (samples: number[]) => samples.reduce((sum, value) => sum + value, 0) / samples.length;
    // 編隊ごとに疎密を作るため、特定の3フレームではなく道中全体で検査する。
    const [low, high, peak] = [[25, 65, 90], [30, 65, 95], [50, 95, 145], [65, 120, 185], [75, 140, 210]][stage - 1];
    expect(average(counts)).toBeGreaterThanOrEqual(low);
    expect(average(counts)).toBeLessThanOrEqual(high);
    expect(Math.max(...counts)).toBeLessThanOrEqual(peak);
    expect(average(earlyCounts)).toBeLessThan(average(bossCounts));
    expect(average(counts)).toBeGreaterThan(previousAverage);
    previousAverage = average(counts);
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
