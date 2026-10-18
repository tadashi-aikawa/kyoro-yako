import type { Bullet, Game } from './game';
import { FIELD } from './rules';

// 直線弾の斉射が指定の高さを通り過ぎるまで、静止して被弾しない自機中心の区間。
// 斜めの弾は判定円を軌道に垂直に広げ、横方向の占有幅へ換算する。
export function safeLanesAtY(bullets: Bullet[], y: number): [number, number][] {
  const from = 9;
  const to = FIELD.w - 9;
  const blocked = bullets.filter((b) => b.vy > 0 && b.y <= y).map((b): [number, number] => {
    const x = b.x + (y - b.y) * b.vx / b.vy;
    const halfWidth = (b.radius + 2.5) * Math.hypot(b.vx, b.vy) / b.vy;
    return [Math.max(from, x - halfWidth), Math.min(to, x + halfWidth)];
  }).filter(([start, end]) => start <= end).sort((a, b) => a[0] - b[0]);
  const safe: [number, number][] = [];
  let cursor = from;
  for (const [start, end] of blocked) {
    if (start > cursor) safe.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < to) safe.push([cursor, to]);
  return safe;
}

// Normalで1〜1800フレーム進め、420〜1800フレームを60フレーム間隔で24回採取する。
export function measureBulletDensity(game: Game): { count: number; traffic: number } {
  let count = 0; let traffic = 0; let samples = 0;
  for (let frame = 1; frame <= 1800; frame++) {
    game.update();
    if (frame <= 400 || frame % 60 !== 0) continue;
    game.bullets.forEach((b) => {
      if (b.x < 0 || b.x > FIELD.w || b.y < 0 || b.y > FIELD.h) return;
      count++;
      if (b.delay === 0) traffic += Math.hypot(b.vx, b.vy);
    });
    samples++;
  }
  return { count: count / samples, traffic: traffic / samples };
}
