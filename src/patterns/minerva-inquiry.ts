import type { Game } from '../game';
import { type Difficulty, density } from '../rules';
import { emitBossNormal } from './boss-normal';

export function gravityScene(frame: number, difficulty: Difficulty) {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const time = Math.max(0, frame - 105), wave = Math.floor(time / 480), local = time % 480;
  const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
  const [dx, dy] = directions[wave % directions.length];
  const warning = [90, 78, 66, 60][level];
  const active = frame >= 105 && local >= warning && local < warning + 180;
  // 低速でも入力で抗える。始めと終わりは滑らかに力を変える。
  const ramp = active ? Math.min(1, (local - warning + 1) / 24, (warning + 180 - local) / 24) : 0;
  const force = [0.6, 0.75, 0.9, 1.05][level] * ramp * (dy < 0 ? 0.65 : 1);
  return { dx, dy, local, wave, warning, active, force, visible: frame >= 105 && local < warning + 180, level };
}

export function emitGravity(game: Game): void {
  if (game.bombFrames > 0) return;
  const t = game.phaseFrame - 105, local = t % 180, mode = Math.floor(t / 180) % 3;
  if (mode < 2) {
    emitBossNormal(game, mode === 0 ? 'minervaStarFan' : 'minervaStarRings', local);
    return;
  }
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  if (local % [45, 36, 30, 24][level] !== 0) return;
  for (let i = 0; i < density(game.difficulty, 4); i++) {
    const bx = 12 + (t * 7 + i * 83) % 360;
    const b = game.spawnBullet(bx, 32, Math.sin(t * 0.02 + i) * 0.22, [1.3, 1.55, 1.8, 2.0][level], i % 2 ? 1 : 2, 'star');
    if (b) b.radius = 3;
  }
}
