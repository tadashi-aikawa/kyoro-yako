import type { Bullet, Game } from '../game';
import { type Difficulty, FIELD } from '../rules';

export const KISS_CHARGE = 18;
export const KISS_POSE_END = 36;
export const KISS_PERIOD = [100, 84, 72, 60] as const;
export const KISS_LIFE = 600;
export const KISS_FADE = 60;
export const KISS_PASS_RADIUS = 58;
export const KISS_ORIGIN = [-1, -21] as const;

export function kissStep(time: number, difficulty: Difficulty): number {
  return time < 0 ? -1 : time % KISS_PERIOD[['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty)];
}

export function emitJinraiKiss(game: Game, time: number, level: number): void {
  const step = kissStep(time, game.difficulty);
  const [bx, by] = game.bossPosition();
  const x = bx + KISS_ORIGIN[0], y = by + KISS_ORIGIN[1];
  if (step === 0) game.spark(x, y, '#ffc0d8', 8);
  if (step !== KISS_CHARGE) return;
  // 10秒残る弾なので一口ずつ送る。画面外の弾も数え、戻り待ちの弾が増えすぎるのを防ぐ。
  const count = game.bullets.objects.filter((b) => b.active && b.motion === 'jinraiHeart').length;
  if (count >= Math.ceil(KISS_LIFE / KISS_PERIOD[level])) return;
  const aim = Math.atan2(game.py - y, game.px - x);
  const speed = [1.65, 1.95, 2.2, 2.45][level];
  const angle = aim + Math.sin(Math.floor(time / KISS_PERIOD[level]) * 2.4) * 0.35;
  const heart = game.spawnBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 3, 'heart');
  if (heart) {
    heart.motion = 'jinraiHeart'; heart.radius = 3.2;
    heart.swayRate = [0.036, 0.04, 0.044, 0.048][level];
    heart.fadeAt = KISS_LIFE;
  }
  game.spark(x, y, '#ff9dbe', 5);
}

export function updateJinraiHeart(heart: Bullet, px: number, py: number): void {
  if (heart.age >= heart.fadeAt - KISS_FADE) {
    heart.vx *= 0.97; heart.vy *= 0.97;
    return;
  }
  // 自機の近くでは一度通り抜ける。画面外でも消さず、間を置いて旋回し再び追いかける。
  // 旋回半径より手前で通り抜けへ移る。自機の周囲を同じ距離で周回する平衡軌道を避ける。
  if (heart.age >= heart.releaseAt && Math.hypot(px - heart.x, py - heart.y) < KISS_PASS_RADIUS) heart.releaseAt = heart.age + 42;
  if (heart.age < heart.releaseAt) return;
  const angle = Math.atan2(heart.vy, heart.vx);
  const target = Math.atan2(py - heart.y, px - heart.x);
  const delta = Math.atan2(Math.sin(target - angle), Math.cos(target - angle));
  const next = angle + Math.max(-heart.swayRate, Math.min(heart.swayRate, delta));
  const speed = Math.hypot(heart.vx, heart.vy);
  heart.vx = Math.cos(next) * speed;
  heart.vy = Math.sin(next) * speed;
}

export function kissEdgeWarning(heart: Bullet): [number, number] | undefined {
  if (heart.motion !== 'jinraiHeart' || heart.age >= heart.fadeAt - KISS_FADE) return;
  if (heart.x >= 0 && heart.x <= FIELD.w && heart.y >= 0 && heart.y <= FIELD.h) return;
  return [Math.max(10, Math.min(FIELD.w - 10, heart.x)), Math.max(10, Math.min(FIELD.h - 10, heart.y))];
}
