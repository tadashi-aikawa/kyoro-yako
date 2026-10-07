import type { Bullet, Game } from '../game';
import { DIFFICULTY, density } from '../rules';

export function emitCommon(game: Game, pattern: string): void {
    const t = game.phaseFrame - 105;
    const [x, y] = game.bossPosition();
    const unit = 0.9 + (DIFFICULTY[game.difficulty] - 1) * 0.18;
    const count = (n: number) => density(game.difficulty, n);
    const interval = (n: number) => Math.max(4, Math.round(n / DIFFICULTY[game.difficulty]));
    const ring = (cx: number, cy: number, n: number, speed: number, color: number, offset = 0, gap = -1, kind: Bullet['kind'] = 'orb') => {
      for (let i = 0; i < n; i++) {
        if (gap >= 0 && Math.abs(((i - gap + n * 4) % n) - n / 2) < 1.4) continue;
        const angle = offset + i * Math.PI * 2 / n;
        game.spawnBullet(cx, cy, Math.cos(angle) * speed, Math.sin(angle) * speed, color, kind);
      }
    };
    if (pattern === 'fan' && t % interval(42) === 0) {
      const angle = Math.atan2(game.py - y, game.px - x);
      for (let i = -3; i <= 3; i++) game.spawnBullet(x, y, Math.cos(angle + i * 0.17) * 1.7 * unit, Math.sin(angle + i * 0.17) * 1.7 * unit, 1);
      ring(x, y, count(32), 1.05 * unit, 2, t * 0.012, 0);
    }
    if (pattern === 'spiral' && t % interval(5) === 0) {
      for (const side of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const a = t * 0.045 + side;
        game.spawnBullet(x, y, Math.cos(a) * 1.6 * unit, Math.sin(a) * 1.6 * unit, 3, 'petal');
      }
      if (t % 84 < 5) ring(x, y, count(30), 1.0 * unit, 0, t * 0.01, 0);
    }
}

