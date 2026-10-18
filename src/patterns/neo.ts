import type { Game } from '../game';

const levelOf = (game: Game) => ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
export function bogs(t: number): [number, number, number][] {
  const cycle = Math.floor(Math.max(0, t) / 270);
  const growth = t < 0 ? 1 : Math.min(1, (t % 270 + 1) / 75);
  return [[78 + cycle % 2 * 24, 235, 49 * growth], [273 - cycle % 3 * 19, 326, 53 * growth], [192, 155, 34 * growth]];
}
export function inBog(x: number, y: number, t: number): boolean {
  return t >= 0 && bogs(t).some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) < r);
}

export function emitNeo(game: Game, pattern: string, t: number): void {
  const level = levelOf(game);
  const [x, y] = game.bossPosition();
  if (pattern === 'keyRain' && t % [190, 170, 150, 130][level] === 0) {
    const row = Math.floor(t / [190, 170, 150, 130][level]) % 3;
    const columns = [9, 10, 11, 12][level];
    const selected = [2, 3, 4, 5][level];
    const base = Math.floor(t / [190, 170, 150, 130][level]) * 3;
    for (let i = 0; i < selected; i++) {
      const column = (base + i * 3) % columns;
      const bx = 34 + column * 316 / (columns - 1);
      const b = game.spawnBullet(bx, 56 + row * 25, 0, [0.92, 1.05, 1.18, 1.32][level], 2, 'keycap');
      if (b) { b.motion = 'keyDrop'; b.delay = [72, 58, 46, 36][level]; b.radius = 6; }
    }
  }
  if (pattern === 'keyInvite' && t % [230, 205, 185, 165][level] === 0) {
    const count = [11, 14, 17, 20][level];
    const cx = Math.max(86, Math.min(298, game.px));
    const cy = Math.max(86, Math.min(362, game.py));
    const gap = Math.floor(((Math.atan2(game.py - cy, game.px - cx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * count);
    const warning = [85, 70, 55, 44][level];
    for (let i = 0; i < count; i++) {
      if ((i - gap + count) % count < 2) continue;
      const a = i * Math.PI * 2 / count;
      const b = game.spawnBullet(cx + Math.cos(a) * 82, cy + Math.sin(a) * 82, -Math.cos(a) * [0.34, 0.42, 0.50, 0.58][level], -Math.sin(a) * [0.34, 0.42, 0.50, 0.58][level], 1, 'keycap');
      if (b) { b.motion = 'keyCircle'; b.delay = warning; b.releaseAt = warning + 24; b.targetX = cx; b.targetY = cy; b.swayPhase = a; b.radius = 5; }
    }
  }
  if (pattern === 'dotfiles' && t % [64, 54, 46, 40][level] === 0) {
    const n = [3, 4, 5, 6][level];
    for (let i = 0; i < n; i++) {
      const a = t * 0.026 + i * Math.PI * 2 / n;
      game.spawnBullet(x, y, Math.cos(a) * [1.0, 1.12, 1.25, 1.4][level], Math.sin(a) * [1.0, 1.12, 1.25, 1.4][level], 0, 'orb');
    }
  }
  if (pattern === 'enter') {
    const period = [175, 155, 140, 125][level];
    const step = t % period;
    const total = [13, 15, 17, 19][level];
    const rate = [7, 6, 5, 4][level];
    if (step % rate !== 0 || step / rate >= total) return;
    const row = Math.floor(t / period) % 3;
    const i = Math.floor(step / rate);
    const b = game.spawnBullet(24 + i * 336 / (total - 1), 112 + row * 42, 0, [1.0, 1.18, 1.34, 1.5][level], 1, 'glyph');
    if (b) { b.motion = 'enterLine'; b.delay = period - step + [56, 48, 40, 32][level]; b.radius = 4; }
  }
}
