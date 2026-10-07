import type { Game } from '../game';

export function emitChappy(game: Game, pattern: string, t: number): void {
  if (pattern !== 'codex') return;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const period = [260, 235, 215, 195][level];
  if (t % period !== 0) return;
  const wave = Math.floor(t / period);
  const n = [1, 2, 2, 3][level];
  const warning = [210, 180, 150, 120][level];
  const [x, y] = game.bossPosition();
  for (let i = 0; i < n; i++) {
    const bx = 86 + (wave * 101 + i * 143) % 215;
    const by = 195 + (wave * 37 + i * 62) % 90;
    const b = game.spawnBullet(x, y, (bx - x) / 38, (by - y) / 38, 2, 'glyph');
    if (b) { b.motion = 'codexBox'; b.delay = warning; b.releaseAt = warning + 1; b.targetX = bx; b.targetY = by; b.gridRow = warning; b.radius = 17; }
  }
}
