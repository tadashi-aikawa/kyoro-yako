import type { Enemy } from './game';

export const ENEMY_ROOMS = ['gate', 'archive', 'gallery', 'sakura', 'dawn'] as const;

// 発射時刻と予告の姿を同じ予定表から決める。
export function enemyFireFrames(enemy: Pick<Enemy, 'kind' | 'slot'>, stage: number): number[] {
  if (stage <= 2 && enemy.slot === 6 && enemy.kind !== 'cross' && enemy.kind !== 'ring') return [];
  if (enemy.kind === 'pincer') return [68, 112];
  if (enemy.kind === 'serpent') return [86 + enemy.slot * 3, 119 + enemy.slot * 3];
  if (enemy.kind === 'orbit') return [100 + enemy.slot * 3];
  if (enemy.kind === 'chevron') return [90 + Math.ceil(enemy.slot / 2) * 5];
  const frames: number[] = [];
  if (enemy.kind === 'cross') frames.push(65, 125);
  if (enemy.kind === 'ring') frames.push(98);
  if (stage <= 2 && enemy.slot === 6) return frames;
  if (enemy.slot > 0) frames.push(92);
  else if (enemy.kind === 'threeWay') frames.push(95);
  else if (enemy.kind === 'sweep') frames.push(88, 113);
  else if (enemy.kind === 'arc' || enemy.kind === 'return') frames.push(100);
  return frames;
}

export function enemyPose(enemy: Enemy, stage: number, playerX: number, playerY: number): number {
  if (enemy.hitFrames > 0) return 2;
  if (Math.hypot(playerX - enemy.x, playerY - enemy.y) < 150) return 0;
  return enemyFireFrames(enemy, stage).some((at) => at - enemy.age >= 0 && at - enemy.age <= 22) ? 1 : 0;
}
