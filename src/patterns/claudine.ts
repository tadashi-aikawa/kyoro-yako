import type { Game } from '../game';
import { updateCourse } from './claudine-course';
import { emitClaudineFinale, finaleTime } from './claudine-finale';
import { emitChangingGrid, emitTypographyRain } from './claudine-weather-grid';

const levelOf = (game: Game) => ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
const warn = [90, 70, 55, 42];

export function claudineScene(game: Game): string | undefined {
  if (game.phase?.pattern !== 'final') return game.phase?.pattern;
  return 'responsiveBloom';
}

export function whiteSpaceCircle(t: number): [number, number, number] {
  return [192 + Math.sin(t * 0.008) * 90, 302 + Math.sin(t * 0.005) * 54, 55 + Math.sin(t * 0.006) * 9];
}

export function complementBoundary(t: number): number { return 192 + Math.sin(t * 0.009) * 65; }

export function emitClaudine(game: Game, pattern: string, t: number): void {
  if (pattern === 'final') { emitClaudineFinale(game, finaleTime(game)); return; }
  const level = levelOf(game);
  const local = t;
  const warning = warn[level];
  if (pattern === 'type') { emitTypographyRain(game, local); return; }
  if (pattern === 'grid') { emitChangingGrid(game, local); return; }
  if (pattern === 'trim') { updateCourse(game, local); return; }
  if (pattern === 'complement' && local % [95, 78, 66, 56][level] === 0) {
    const n = [7, 9, 11, 13][level];
    for (let i = 0; i < n; i++) {
      const bx = 18 + i * 348 / (n - 1);
      const b = game.spawnBullet(bx, 25, Math.sin(i * 3 + local) * 0.22, [0.9, 1, 1.1, 1.2][level], 1, 'orb');
      if (b) { b.motion = 'complement'; b.delay = warning; b.radius = 4; }
    }
  }
  if (pattern === 'whiteSpace' && local % [36, 28, 23, 19][level] === 0) {
    const step = [27, 23, 20, 18][level];
    const offset = Math.floor(local / step) % 2 * step / 2;
    for (let bx = 8 + offset; bx < 380; bx += step) {
      const b = game.spawnBullet(bx, 22, 0, [0.9, 1.08, 1.23, 1.4][level], 0, 'needle');
      if (b) { b.motion = 'whiteSpace'; b.delay = warning; b.radius = 3; }
    }
  }
}
