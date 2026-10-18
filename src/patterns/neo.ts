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
const VIM_ATTACKS = [
  { command: '3j', rounds: 3, shift: 0, copies: 0, erase: false },
  { command: '3j2hyyp', rounds: 3, shift: -1, copies: 1, erase: false },
  { command: '2h', rounds: 1, shift: -1, copies: 0, erase: false },
  { command: '2lyy2p', rounds: 1, shift: 1, copies: 2, erase: false },
  { command: 'yy3p', rounds: 1, shift: 0, copies: 3, erase: false },
  { command: '2hyy3p', rounds: 1, shift: -1, copies: 3, erase: false },
  { command: '2l', rounds: 1, shift: 1, copies: 0, erase: false },
  { command: '3jdd', rounds: 3, shift: 0, copies: 0, erase: true },
  { command: 'dd', rounds: 2, shift: 0, copies: 0, erase: true },
] as const;
export const VIM_COMMANDS = VIM_ATTACKS.map((attack) => attack.command);
export const VIM_PERIOD = 210;
export interface VimAttack { wave: number; x: number; y: number; angle: number; }
export function vimScene(t: number, level: number) {
  const wave = Math.floor(Math.max(0, t) / VIM_PERIOD);
  const attack = VIM_ATTACKS[wave % VIM_ATTACKS.length];
  const step = Math.max(0, t) % VIM_PERIOD;
  return { wave, ...attack, step, warning: [72, 60, 48, 40][level] };
}
export function updateVimBullet(b: Bullet): void {
  // h/l は弾道を左/右へ2段ずらす。扇の速度は保ち、上下の進みを止めない。
  const step = b.age - b.releaseAt;
  if (step >= 0 && step < 12 || step >= 24 && step < 36) b.x += b.sway;
  if (step >= 36) b.motion = 'normal';
}

function emitVim(game: Game, t: number, level: number): void {
  const scene = vimScene(t, level);
  if (game.bombFrames > 0) return;
  if (scene.step === 0) {
    const [x, y] = game.bossPosition();
    game.vimAttack = { wave: scene.wave, x, y, angle: Math.PI / 2 };
  }
  // 予告と後続射撃を同じ状態へ束ねる。ボム・被弾・技切替の消去でコピー射撃も中止する。
  const attack = game.vimAttack;
  if (!attack || attack.wave !== scene.wave) return;
  const elapsed = scene.step - scene.warning;
  if (elapsed === 0) {
    [attack.x, attack.y] = game.bossPosition();
    attack.angle = scene.command.startsWith('3j') ? Math.PI / 2 : Math.max(0.7, Math.min(Math.PI - 0.7, Math.atan2(game.py - attack.y, game.px - attack.x)));
  }
  let volley = -1;
  let copied = false;
  const lastRound = (scene.rounds - 1) * 20;
  if (elapsed >= 0 && elapsed <= lastRound && elapsed % 20 === 0) volley = elapsed / 20;
  // 複合コマンドは元の扇を横へ動かし終えてから、移動後の発射位置をコピーする。
  // 最長の複合もEasyの予告72fを含め210f内に収める。
  const copyAt = scene.shift ? lastRound + 56 : 36;
  const copyGap = Math.max(scene.shift ? 24 : 36, scene.rounds * 20);
  for (let copy = 0; copy < scene.copies; copy++) for (let round = 0; round < scene.rounds; round++) {
    if (elapsed === copyAt + copy * copyGap + round * 20) { volley = (copy + 1) * scene.rounds + round; copied = true; }
  }
  if (volley >= 0) {
    const n = [7, 9, 11, 13][level], spread = [0.15, 0.13, 0.115, 0.105][level];
    const speed = [1.25, 1.45, 1.7, 1.9][level];
    for (let i = 0; i < n; i++) {
      const angle = attack.angle + (i - (n - 1) / 2) * spread;
      const b = game.spawnBullet(attack.x + (copied ? scene.shift * 43.2 : 0), attack.y, Math.cos(angle) * speed, Math.sin(angle) * speed, scene.erase ? 3 : copied ? 2 : 1);
      if (!b) continue;
      b.dashWave = scene.wave; b.dashOrder = volley;
      if (scene.shift && !copied) { b.motion = 'vim'; b.sway = scene.shift * 1.8; b.releaseAt = lastRound + 19 - elapsed; }
    }
  }
  if (scene.erase && elapsed === lastRound + 30) game.bullets.forEach((b) => {
    if (b.dashWave !== scene.wave || b.dashOrder !== 0) return;
    game.spark(b.x, b.y, '#ffb3cc', 2); b.active = false;
  });
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
