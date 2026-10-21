import type { Game } from '../game';
import { type Difficulty, density } from '../rules';
import { emitBossNormal } from './boss-normal';

export const SOCRATIC_SYMBOLS = ['◇', '○', '☆', '△'] as const;
const MAPPINGS = [[1, 2, 3, 0], [2, 3, 1, 0], [3, 0, 1, 2], [2, 0, 3, 1], [1, 3, 0, 2], [3, 2, 0, 1]] as const;
export function socraticScene(frame: number, difficulty: Difficulty) {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const period = [480, 450, 420, 390][level];
  const time = Math.max(0, frame - 105), wave = Math.floor(time / period), local = time % period;
  const mapping = MAPPINGS[wave % MAPPINGS.length];
  const source = (wave * 3 + 1) % 4;
  const answer = mapping[mapping[source]];
  const lane = (wave * 2 + Math.floor(wave / 3) + 1) % 3;
  const choices = [answer, source, mapping[source]];
  const gates = [0, 1, 2].map(i => choices[(i - lane + 3) % 3]);
  const rows = [0, 1, 2, 3].map(i => (i + wave) % 4);
  const reveal = [210, 180, 150, 132][level];
  const grace = [90, 54, 45, 36][level];
  return { level, period, wave, local, mapping, source, answer, lane, gates, rows, reveal, grace };
}

export function emitSocratic(game: Game): void {
  if (game.bombFrames > 0) return;
  const scene = socraticScene(game.phaseFrame, game.difficulty);
  const [x, y] = game.bossPosition();
  // 考える間も少量の遅い弾を流す。対応表を読める量にとどめる。
  if (scene.local < scene.reveal - 60 && scene.local % 90 === 30) {
    const aim = Math.atan2(game.py - y, game.px - x);
    for (let i = -1; i <= 1; i++) {
      const a = aim + i * 0.22;
      const b = game.spawnBullet(x, y, Math.cos(a) * 1.15, Math.sin(a) * 1.15, 1, 'star');
      if (b) b.radius = 2.6;
    }
  }
  if (scene.local !== scene.reveal) return;
  game.audio.play('turn');
  const columns = [5, 6, 7, 8][scene.level];
  const spacing = 120 / (columns - 1);
  for (let lane = 0; lane < 3; lane++) {
    if (lane === scene.lane) continue;
    for (let row = 0; row < 10; row++) for (let column = 0; column < columns; column++) {
      const shift = Math.sin(scene.wave * 1.3 + row * 0.8) * spacing * 0.32;
      const bx = lane * 128 + Math.max(4, Math.min(124, 4 + column * spacing + shift));
      const b = game.spawnBullet(bx, 222 + row * 24, 0, [0.8, 1.05, 1.25, 1.45][scene.level], 3, 'orb');
      if (b) { b.delay = scene.grace; b.radius = 2.6; }
    }
  }
}

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
