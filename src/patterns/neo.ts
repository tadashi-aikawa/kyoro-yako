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
export const VIM_COMMANDS = ['5Gyy3p', '3Gyy2p', '4G2dd', '2Gyy3p', '6Gdd'] as const;
const VIM_EDITS = [
  { line: 5, copies: 3, remove: 0 }, { line: 3, copies: 2, remove: 0 },
  { line: 4, copies: 0, remove: 2 }, { line: 2, copies: 3, remove: 0 }, { line: 6, copies: 0, remove: 1 },
] as const;
export const VIM_PERIOD = 540;
export const VIM_ROWS = 7;
export const VIM_LINE_HEIGHT = 24;
export const vimLineY = (row: number) => 104 + row * VIM_LINE_HEIGHT;
export function vimScene(t: number, level: number) {
  const wave = Math.floor(Math.max(0, t) / VIM_PERIOD);
  const command = VIM_COMMANDS[wave % VIM_COMMANDS.length];
  const edit = VIM_EDITS[wave % VIM_EDITS.length];
  const step = Math.max(0, t) % VIM_PERIOD;
  const warning = [110, 94, 78, 66][level];
  const yankAt = warning + 28;
  const editAt = yankAt + 28;
  const launchAt = editAt + Math.max(0, edit.copies - 1) * 22 + 40;
  const pasted = edit.copies ? Math.max(0, Math.min(edit.copies, Math.floor((step - editAt) / 22) + 1)) : 0;
  const rowCount = VIM_ROWS + pasted - (step >= editAt ? edit.remove : 0);
  // n p は一度の貼り付け。段階表示中もカーソルは最初に挿入した行に置く。
  const cursorRow = step < warning ? 0 : Math.min(rowCount - 1, edit.line - 1 + (pasted ? 1 : 0));
  const tokens = [`${edit.line}G`, ...(edit.copies ? ['yy', `${edit.copies}p`] : [edit.remove > 1 ? `${edit.remove}dd` : 'dd'])];
  const token = step < warning ? -1 : step < yankAt ? 0 : edit.copies && step >= editAt ? 2 : 1;
  return { wave, command, ...edit, step, warning, yankAt, editAt, launchAt, pasted, rowCount, cursorRow, tokens, token };
}
export function updateVimBullet(b: Bullet): void {
  b.motion = 'normal'; b.vy = b.spin;
}

function emitVim(game: Game, t: number, level: number): void {
  const scene = vimScene(t, level);
  if (game.bombFrames > 0) return;
  const addKey = (x: number, row: number, column: number, label: string, color: number) => {
    const b = game.spawnBullet(x, vimLineY(row), 0, 0, color, 'keycap');
    if (!b) return;
    // 見た目は幅18px。半径7なら自機半径2.5との和が列間の半分を上回り、細い縦抜けを残さない。
    b.motion = 'vim'; b.keyLabel = label; b.radius = 7;
    b.delay = scene.launchAt - scene.step; b.releaseAt = b.delay;
    b.gridRow = row; b.gridColumn = column; b.dashWave = scene.wave;
    b.spin = [1.25, 1.55, 1.85, 2.15][level];
  };
  if (scene.step === 0) {
    const gapX = [102, 278, 182, 310, 142][scene.wave % 5];
    const gap = [84, 68, 56, 54][level];
    const lines = ['const neo = vim()', 'normal mode only', 'copy this line()', 'yank into memory', 'paste the stars!', 'delete this line', 'return to normal'];
    for (let row = 0; row < VIM_ROWS; row++) for (let col = 0; col < 22; col++) {
      const x = 12 + col * 18;
      // 段差を等間隔にし、削除しても移動可能な範囲へ収める。Easyだけは縦に共通の穴を残す。
      const rowGap = gapX + (row / 3 - 1) * [16, 42, 45, 48][level] * (scene.wave % 2 ? -1 : 1);
      if (Math.abs(x - rowGap) < gap / 2) continue;
      addKey(x, row, col, lines[row][col % lines[row].length], row % 2 ? 1 : 2);
    }
  }
  // 生きた行だけを編集する。ボム・被弾で消えた波から後続の複製を復活させない。
  const keys = game.bullets.objects.filter((b) => b.active && b.motion === 'vim' && b.dashWave === scene.wave);
  const sourceRow = scene.line - 1;
  if (scene.copies && scene.step >= scene.editAt && scene.step < scene.editAt + scene.copies * 22 && (scene.step - scene.editAt) % 22 === 0) {
    const row = scene.line + (scene.step - scene.editAt) / 22;
    for (const b of keys) if (b.gridRow >= row) { b.gridRow++; b.y = vimLineY(b.gridRow); }
    for (const b of keys) if (b.gridRow === sourceRow) addKey(b.x, row, b.gridColumn, b.keyLabel!, b.color);
  }
  if (scene.remove && scene.step === scene.editAt) for (const b of keys) {
    if (b.gridRow >= sourceRow && b.gridRow < sourceRow + scene.remove) b.active = false;
    else if (b.gridRow >= sourceRow + scene.remove) { b.gridRow -= scene.remove; b.y = vimLineY(b.gridRow); }
  }
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
    if (b) { b.motion = 'enterLine'; b.delay = release - step; b.radius = 4; }
  }
}
