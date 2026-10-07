import type { Game } from '../game';
import { DIFFICULTY, density } from '../rules';

const levelOf = (game: Game) => ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
export const SWEEP_PERIOD = [330, 300, 270, 240] as const;
export const SWEEP_CHARGE = [96, 78, 62, 48] as const;
export const SWEEP_MOVE = 36;
export const SWEEP_SHOTS = [0, 12, 24] as const;
export const sweepStep = (frame: number, level: number): number => frame < 105 ? -1 : (frame - 105) % SWEEP_PERIOD[level];
export const sweepTarget = (wave: number): [number, number] => [84 + (wave * 137 + 49) % 216, 140 + (wave * 83 + 11) % 120];
export function sweepPosition(frame: number, level: number): [number, number] {
  if (frame < 105) return [192, 150];
  const t = frame - 105; const wave = Math.floor(t / SWEEP_PERIOD[level]);
  const from = wave === 0 ? [192, 150] : sweepTarget(wave - 1);
  const to = sweepTarget(wave);
  const progress = Math.min(1, t % SWEEP_PERIOD[level] / SWEEP_MOVE);
  const ease = progress * progress * (3 - 2 * progress);
  return [from[0] + (to[0] - from[0]) * ease, from[1] + (to[1] - from[1]) * ease];
}
export function tags(t: number): [number, number][] {
  const sway = Math.sin(t * 0.012) * 19;
  return [[75 + sway, 213], [192, 304], [309 - sway, 224]];
}
export function emitObsidia(game: Game, pattern: string, t: number): void {
  const level = levelOf(game);
  const [x, y] = game.bossPosition();
  const interval = (n: number) => Math.max(4, Math.round(n / DIFFICULTY[game.difficulty]));
  if (pattern === 'bookshelf' && t % [160, 140, 122, 108][level] === 0) {
    const wave = Math.floor(t / [160, 140, 122, 108][level]);
    const side = wave % 2 ? -1 : 1;
    const offset = wave * 2 % 6;
    const warning = [90, 70, 54, 42][level];
    for (let i = 0; i < 3; i++) {
      const lane = (offset + i) % 6;
      const b = game.spawnBullet(side > 0 ? -8 : 392, 170 + lane * 46, side * 3.2, 0, 0, 'glyph');
      if (b) { b.motion = 'bookshelf'; b.delay = warning; b.releaseAt = warning + 50; b.targetX = side; b.radius = 10; }
    }
  }
  if (pattern === 'clean' && t % interval(92) === 0) {
    const n = density(game.difficulty, 32);
    const gap = (Math.floor(t / interval(92)) * 7) % n;
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n + t * 0.004;
      const b = game.spawnBullet(x, y, Math.cos(a) * [1.0, 1.13, 1.28, 1.43][level], Math.sin(a) * [1.0, 1.13, 1.28, 1.43][level], 0, 'orb');
      if (b && (i - gap + n) % n < [6, 5, 4, 3][level]) { b.motion = 'vanish'; b.color = 2; b.fadeAt = [78, 65, 54, 46][level]; }
    }
  }
  if (pattern === 'link' && t % [230, 200, 175, 150][level] === 0) {
    const nodes = [5, 6, 7, 8][level];
    const gap = Math.floor(t / [230, 200, 175, 150][level]) % (nodes - 1);
    const warning = [82, 66, 52, 42][level];
    const y0 = 90;
    for (let i = 0; i < nodes; i++) {
      const nx = 30 + i * 324 / (nodes - 1);
      const node = game.spawnBullet(nx, y0 + (i % 2) * 38, 0, [0.72, 0.84, 0.96, 1.08][level], 2, 'star');
      if (node) { node.motion = 'linkNode'; node.delay = warning; node.radius = 6; }
      if (i >= nodes - 1 || i === gap) continue;
      const nextX = 30 + (i + 1) * 324 / (nodes - 1);
      const nextY = y0 + ((i + 1) % 2) * 38;
      for (let j = 1; j < 12; j++) {
        const b = game.spawnBullet(nx + (nextX - nx) * j / 12, y0 + (i % 2) * 38 + (nextY - (y0 + (i % 2) * 38)) * j / 12, 0, [0.72, 0.84, 0.96, 1.08][level], 1, 'needle');
        if (b) { b.motion = 'linkBeam'; b.delay = warning; b.radius = 3; }
      }
    }
  }
  if (pattern === 'tags' && t % [100, 82, 70, 58][level] === 0) {
    const centers = tags(t);
    for (let color = 0; color < 3; color++) {
      const n = [2, 3, 4, 5][level];
      for (let i = 0; i < n; i++) {
        const bx = 28 + (color * 107 + i * 73 + t * 2) % 328;
        const b = game.spawnBullet(bx, 30, (centers[color][0] - bx) * 0.001, [1.08, 1.2, 1.33, 1.46][level], color, 'orb');
        if (b) { b.motion = 'tagPull'; b.radius = 4; }
      }
    }
  }
  if (pattern === 'sweep') {
    const step = t % SWEEP_PERIOD[level];
    if (step === SWEEP_MOVE) game.audio.play('sweepCharge');
    const shot = (SWEEP_SHOTS as readonly number[]).indexOf(step - SWEEP_MOVE - SWEEP_CHARGE[level]);
    if (shot < 0) return;
    game.audio.play('sweepBurst'); game.spark(x, y, '#e1bdff', 18);
    const wave = Math.floor(t / SWEEP_PERIOD[level]);
    const mode = wave % 3;
    const count = [28, 36, 44, 52][level];
    const speed = [1.95, 2.5, 2.9, 3.3][level] + shot * 0.2;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count + wave * 0.63 + shot * Math.PI / count * (mode === 1 ? 1 : 0.5);
      const vx = Math.cos(angle) * speed * (mode === 2 ? 1.12 : 1);
      const vy = Math.sin(angle) * speed * (mode === 2 ? 0.9 : 1);
      const b = game.spawnBullet(x, y, vx, vy, (shot + 2) % 4, mode === 1 ? 'star' : mode === 2 && i % 2 ? 'needle' : 'orb');
      if (b) {
        b.motion = 'sweepRadial'; b.radius = mode === 1 ? 3.2 : 3.5;
        b.sway = mode === 1 ? (shot % 2 ? -1 : 1) * [0.005, 0.006, 0.007, 0.008][level] : 0;
        b.gridColumn = mode; b.gridRow = shot;
      }
    }
  }
}
