import type { Game } from '../game';
import { emitNeo } from './neo';

export function encoreBogTime(game: Game): number {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  return game.phaseFrame - 105 - [120, 95, 75, 60][level];
}

export function emitNeoEncore(game: Game, t: number): void {
  if (game.encoreCount === 1) emitNeo(game, 'keyRain', t);
  else if (game.encoreCount === 2) emitNeo(game, 'vim', t);
  else if (game.encoreCount === 3) emitNeo(game, 'dotfiles', t);
  else if (t % 85 === 0) {
    const [x, y] = game.bossPosition();
    const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
    const n = [10, 14, 18, 22][level];
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n;
      const b = game.spawnBullet(x, y, Math.cos(a) * 0.8, Math.sin(a) * 0.8, 2, 'star');
      if (b) b.delay = [80, 64, 52, 42][level];
    }
  }
}
