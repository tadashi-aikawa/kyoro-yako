import type { Game } from '../game';
import { emitClaudineFinale, finaleTime } from './claudine-finale';
import { emitChangingGrid, emitTypographyRain } from './claudine-weather-grid';

const levelOf = (game: Game) => ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
const warn = [90, 70, 55, 42];

export function claudineScene(game: Game): string | undefined {
  if (game.phase?.pattern !== 'final') return game.phase?.pattern;
  if (finaleTime(game) >= 0) return 'rose';
  return ['trim', 'type', 'grid', 'complement', 'whiteSpace'][Math.floor(Math.max(0, game.phaseFrame - 105) / 600)];
}

export function whiteSpaceCircle(t: number): [number, number, number] {
  return [192 + Math.sin(t * 0.008) * 90, 302 + Math.sin(t * 0.005) * 54, 55 + Math.sin(t * 0.006) * 9];
}

export function complementBoundary(t: number): number { return 192 + Math.sin(t * 0.009) * 65; }

export function emitClaudine(game: Game, pattern: string, t: number): void {
  const level = levelOf(game);
  const lite = pattern === 'final';
  const scene = lite ? claudineScene(game) : pattern;
  if (scene === 'rose') { emitClaudineFinale(game, finaleTime(game)); return; }
  if (lite && t > 0 && t % 600 === 0) game.bullets.clear();
  if (!scene) return;
  const local = lite ? t % 600 : t;
  const warning = warn[level] + (lite ? 18 : 0);
  if (scene === 'type') { emitTypographyRain(game, local, lite); return; }
  if (scene === 'grid') { emitChangingGrid(game, local, lite); return; }
  if (scene === 'trim' && local % (lite ? 210 : [190, 170, 150, 135][level]) === 0) {
    const wave = Math.floor(local / (lite ? 210 : [190, 170, 150, 135][level]));
    const columns = lite ? 23 : [23, 27, 30, 34][level];
    const gap = 4 + wave * 7 % (columns - 9);
    for (let row = 0; row < (lite ? 2 : 3); row++) for (let col = 0; col < columns; col++) {
      const bx = 8 + col * 368 / (columns - 1);
      const by = 36 + row * 16;
      const cut = col >= gap && col <= gap + 5 + (row === 1 ? 1 : 0);
      const b = game.spawnBullet(bx, by, 0, [0.82, 1.03, 1.24, 1.45][level], cut ? 2 : 0, 'glyph');
      if (!b) continue;
      b.radius = 5;
      if (cut) { b.motion = 'trim'; b.vy = 0; b.fadeAt = warning; }
      else b.delay = warning + 8;
    }
  }
  if (scene === 'complement' && local % (lite ? 100 : [95, 78, 66, 56][level]) === 0) {
    const n = lite ? 7 : [7, 9, 11, 13][level];
    for (let i = 0; i < n; i++) {
      const bx = 18 + i * 348 / (n - 1);
      const b = game.spawnBullet(bx, 25, Math.sin(i * 3 + local) * 0.22, [0.9, 1, 1.1, 1.2][level], 1, 'orb');
      if (b) { b.motion = 'complement'; b.delay = warning; b.radius = 4; }
    }
  }
  if (scene === 'whiteSpace' && local % (lite ? 34 : [36, 28, 23, 19][level]) === 0) {
    const step = lite ? 27 : [27, 23, 20, 18][level];
    const offset = Math.floor(local / step) % 2 * step / 2;
    for (let bx = 8 + offset; bx < 380; bx += step) {
      const b = game.spawnBullet(bx, 22, 0, [0.9, 1.08, 1.23, 1.4][level], 0, 'needle');
      if (b) { b.motion = 'whiteSpace'; b.delay = warning; b.radius = 3; }
    }
  }
}
