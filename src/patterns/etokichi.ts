import type { Game } from '../game';

export function emitEtokichi(game: Game, t: number): void {
  if (t % 390 !== 0) return;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const count = [8, 10, 12, 14][level];
  const [x, y] = game.bossPosition();
  for (let i = 0; i < count; i++) {
    const angle = i * Math.PI * 2 / count;
    const b = game.spawnBullet(x + Math.cos(angle) * 72, y + Math.sin(angle) * 23, 0, 0, 2, 'star');
    if (!b) continue;
    b.motion = 'etoileOrbit';
    b.targetX = x; b.targetY = y;
    b.swayPhase = angle;
    b.releaseAt = [105, 88, 76, 66][level] + i * [37, 31, 26, 22][level];
    b.swayRate = [0.009, 0.011, 0.013, 0.015][level];
  }
}
