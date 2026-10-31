import { enterBossX } from '../boss-movement';
import type { Game } from '../game';
import { FIELD } from '../rules';

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
export const VIM_PREPARE = [150, 150, 120, 105] as const;
function emitVim(game: Game, t: number, level: number): void {
  const elapsed = t - VIM_PREPARE[level];
  if (elapsed < 0 || game.bombFrames > 0) return;
  const period = [126, 114, 102, 90][level];
  const wave = Math.floor(elapsed / period), step = elapsed % period;
  // 横列の抜け道がゆっくり往復する。慣れないキーでも追える幅と速度を保つ。
  if (step === 0) {
    const gapX = 192 + Math.sin(wave * 0.85) * 116;
    const gap = [112, 100, 88, 78][level], spacing = [24, 22, 20, 18][level];
    const offset = wave % 2 * spacing / 2;
    for (let bx = 8 + offset; bx <= FIELD.w; bx += spacing) {
      if (Math.abs(bx - gapX) < gap / 2) continue;
      game.spawnBullet(bx, -12, 0, [1.1, 1.25, 1.45, 1.65][level], wave % 2 ? 0 : 1);
    }
  }
  // 横列の合間に疎らな自機狙いを挟み、左右移動だけの反復にしない。
  if (wave % 2 === 1 && step === Math.floor(period / 2)) {
    const [x, y] = game.bossPosition();
    const aim = Math.atan2(game.py - y, game.px - x), n = [3, 3, 5, 5][level];
    for (let i = 0; i < n; i++) {
      const angle = aim + (i - (n - 1) / 2) * 0.24;
      game.spawnBullet(x, y, Math.cos(angle) * 1.35, Math.sin(angle) * 1.35, 2);
    }
  }
}
export function enterScene(t: number, level: number) {
  const period = [260, 240, 220, 200][level];
  const wave = Math.floor(Math.max(0, t) / period);
  const spacing = [20, 18, 16, 14][level];
  const offset = Math.sin(wave * 2.4) * spacing * 0.45;
  // 文字が画面を下る間のネオへ抜け道を寄せ、反射中も狙って攻撃できるようにする。
  const gapX = enterBossX(wave * period + period - 56 + 100);
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
  if (pattern === 'vim') emitVim(game, t, level);
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
    if (b) { b.motion = 'enterLine'; b.delay = release - step; b.radius = 4; b.gridColumn = i; }
  }
}
