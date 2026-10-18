import type { Bullet, Game } from '../game';

const levelOf = (game: Game) => ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
export const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const;
export const KEY_WORDS = [
  ['CODE', 'EDIT', 'FILE', 'STAR', 'TYPE', 'VIM', 'OWL'],
  ['EDITOR', 'CONFIG', 'PLUGIN', 'SCRIPT', 'TYPING', 'INSERT', 'NORMAL', 'SYNTAX', 'OBJECT', 'MODULE', 'BACKUP', 'SEARCH', 'SWITCH'],
  ['KEYBOARD', 'BACKFIRE', 'DOCUMENT', 'TRIANGLE', 'CHAMPION', 'PAINTBOX'],
  ['WORKSPACE', 'ALGORITHM', 'COPYRIGHT', 'QUICKSTEP', 'NIGHTMARE'],
] as const;
export function keyPosition(row: number, column: number): [number, number] {
  return [39 + row * 12 + column * 32, 98 + row * 26];
}
export const VIM_COMMANDS = ['h', 'j', 'k', 'l', 'dd'] as const;
export const VIM_PERIOD = 360;
export const VIM_MOVE = 48;
export function vimScene(t: number, level: number) {
  const wave = Math.floor(Math.max(0, t) / VIM_PERIOD);
  const command = VIM_COMMANDS[wave % VIM_COMMANDS.length];
  const warning = [96, 78, 64, 52][level];
  const dx = command === 'h' ? -32 : command === 'l' ? 32 : 0;
  const dy = command === 'j' ? 34 : command === 'k' ? -34 : 0;
  return { wave, command, warning, dx, dy, step: Math.max(0, t) % VIM_PERIOD };
}
export function updateVimBullet(b: Bullet): void {
  if (b.age <= b.releaseAt) {
    const progress = Math.max(0, Math.min(1, (b.age - b.releaseAt + VIM_MOVE) / VIM_MOVE));
    b.x = b.targetX + b.sway * progress; b.y = b.targetY + b.swayRate * progress;
  } else { b.motion = 'normal'; b.vy = b.spin; }
}
export function enterScene(t: number, level: number) {
  const period = [260, 240, 220, 200][level];
  const wave = Math.floor(Math.max(0, t) / period);
  const spacing = [20, 18, 16, 14][level];
  const offset = Math.sin(wave * 2.4) * spacing * 0.45;
  const gapX = [88, 192, 296, 192][wave % 4] + Math.sin(wave * 1.7) * 12;
  return { wave, period, step: Math.max(0, t) % period, spacing, offset, gapX, gap: [78, 68, 60, 52][level], release: period - 56, y: 112 + wave % 3 * 30 };
}
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
    const words = KEY_WORDS[level].filter((word) => word !== game.keyboardWord);
    game.keyboardWord = words[Math.floor(Math.random() * words.length)];
    for (const letter of game.keyboardWord) {
      const row = KEY_ROWS.findIndex((keys) => keys.includes(letter));
      const column = KEY_ROWS[row].indexOf(letter);
      const [bx, by] = keyPosition(row, column);
      const b = game.spawnBullet(bx, by, 0, [1.15, 1.35, 1.55, 1.75][level], 2, 'keycap');
      if (b) { b.motion = 'keyDrop'; b.delay = [90, 74, 60, 48][level]; b.radius = 6; b.keyLabel = letter; }
    }
  }
  if (pattern === 'vim' && t % VIM_PERIOD === 0) {
    const scene = vimScene(t, level);
    const gapColumn = [2, 5, 8, 5, 2][scene.wave % 5];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 11; col++) {
      if (Math.abs(col - gapColumn) <= (level === 0 ? 1 : 0)) continue;
      const b = game.spawnBullet(32 + Math.sin(scene.wave * 1.7) * 12 + col * 32, 110 + row * 34, 0, 0, row === 1 ? 1 : 2, 'keycap');
      if (!b) continue;
      b.motion = 'vim'; b.keyLabel = scene.command; b.radius = 5;
      b.delay = scene.warning; b.releaseAt = scene.warning + VIM_MOVE;
      b.targetX = b.x; b.targetY = b.y; b.sway = scene.dx; b.swayRate = scene.dy;
      b.spin = [1.05, 1.25, 1.45, 1.65][level]; b.gridRow = row;
      if (scene.command === 'dd' && row === 1) b.fadeAt = scene.warning;
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
    const { step, spacing, offset, gapX, gap, release, y } = enterScene(t, level);
    const total = Math.floor(368 / spacing) + 1;
    const rate = [6, 5, 4, 3][level];
    if (step % rate !== 0 || step / rate >= total) return;
    const i = Math.floor(step / rate);
    const bx = Math.max(7, Math.min(377, 8 + i * spacing + offset));
    if (Math.abs(bx - gapX) < gap / 2) return;
    const b = game.spawnBullet(bx, y, 0, [1.2, 1.4, 1.6, 1.8][level], 1, 'glyph');
    if (b) { b.motion = 'enterLine'; b.delay = release - step; b.radius = 4; }
  }
}
