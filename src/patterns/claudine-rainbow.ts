import type { Bullet, Game } from '../game';
import { FIELD } from '../rules';

export const RAINBOW_COLORS = ['#ff809b', '#ffb674', '#ffe797', '#9de6ac', '#77ddeb', '#9cafff', '#dfa4f0'] as const;
export const RAINBOW_SECTION = 480;
export const RAINBOW_PERIOD = [8, 6, 6, 5] as const;
export const RAINBOW_PHRASE = [160, 160, 120, 96] as const;
export const RAINBOW_BURST = [32, 36, 30, 35] as const;
export const RAINBOW_SPEED = [0.86, 1, 1.12, 1.22] as const;
export const RAINBOW_LIMIT = [1500, 1900, 2100, 2300] as const;
const AIM_PERIOD = [210, 156, 144, 132] as const;
const TAIL_POINTS = 14;
interface Trail { points: Float32Array; head: number; count: number; }
const trails = new WeakMap<Bullet, Trail>();

export const rainbowSection = (t: number): number => Math.floor(Math.max(0, t) % (RAINBOW_SECTION * 3) / RAINBOW_SECTION);
const levelOf = (game: Game) => ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);

export function rainbowBossPosition(t: number): [number, number] {
  const p = Math.min(1, Math.max(0, t) / 90), entrance = p * p * (3 - 2 * p);
  return [192 + Math.sin(t * 0.006) * 36 * entrance, 132 - entrance * 32 + Math.sin(t * 0.006) * 8 * entrance];
}

function resetTrail(b: Bullet): void {
  let trail = trails.get(b);
  if (!trail) { trail = { points: new Float32Array(TAIL_POINTS * 2), head: 0, count: 0 }; trails.set(b, trail); }
  trail.head = 0; trail.count = 0;
}

function spawnRainbow(game: Game, x: number, y: number, angle: number, speed: number, color: number, level: number, jewel = false): Bullet | undefined {
  const b = game.spawnBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, 'orb');
  if (!b) return;
  b.motion = 'rainbowVeil'; b.dashWave = jewel ? 1 : 0;
  b.radius = jewel ? 1.8 + level * 0.1 : [1.9, 2.1, 2.2, 2.3][level];
  b.sway = 0.0018 * RAINBOW_SPEED[level]; b.launchSoundPending = false;
  resetTrail(b);
  return b;
}

export function emitRainbow(game: Game, t: number): void {
  if (t < 0 || game.bombFrames > 0) return;
  const level = levelOf(game), section = rainbowSection(t);
  // 七色をまとめて放ち、次のフレーズまでの間隔を曲線の間の通路にする。
  const local = t % RAINBOW_SECTION;
  const phraseFrame = local % RAINBOW_PHRASE[level];
  const ribbon = phraseFrame < RAINBOW_BURST[level] && phraseFrame % RAINBOW_PERIOD[level] === 0;
  const aimed = section > 0 && t % AIM_PERIOD[level] === 0;
  if (!ribbon && !aimed) return;
  const cycle = Math.floor(t / (RAINBOW_SECTION * 3)), sign = cycle % 2 ? -1 : 1;
  const scale = RAINBOW_SPEED[level], layers = level === 0 ? 2 : 3;
  let room = RAINBOW_LIMIT[level] - game.bullets.count, first = true;
  const [bx, by] = game.bossPosition();
  if (ribbon && room >= layers * 14 + (aimed ? 21 : 0)) {
    const phraseStart = t - local % RAINBOW_PHRASE[level];
    const swing = Math.sin(phraseStart * 0.009 + cycle * 0.7) * 0.8;
    for (const side of [-1, 1]) for (let layer = 0; layer < layers; layer++) for (let color = 0; color < 7; color++) {
      const origin = section === 0 ? bx : bx + side * (70 + Math.sin(t * 0.006) * 22);
      const angle = Math.PI / 2 + sign * (side * (0.22 + color * 0.022 + layer * 0.3) + swing) * (section === 1 ? 1.3 : 1);
      const b = spawnRainbow(game, origin, by, angle, (1.5 + color * 0.018 + section * 0.08) * scale, color, level);
      if (!b) continue;
      b.spin = side * sign * (section === 1 ? 0.0018 : 0.0008); b.gridRow = layer;
      b.releaseAt = section === 2 && layer === layers - 1 && phraseFrame === 0 ? 125 : 0;
      b.launchSoundPending = first; first = false;
    }
    room -= layers * 14;
  }
  if (aimed && room >= 21) {
    const aim = Math.atan2(game.py - by, game.px - bx);
    for (let color = 0; color < 7; color++) for (let j = -1; j <= 1; j++) {
      const b = spawnRainbow(game, bx, by, aim + j * 0.2 + (color - 3) * 0.017, (1.7 + color * 0.055) * scale, color, level, true);
      if (b) { b.launchSoundPending = first; first = false; }
    }
  }
}

export function updateRainbowBullet(game: Game, b: Bullet): boolean {
  if (b.motion !== 'rainbowVeil') return false;
  if (b.delay > 0) return true;
  const trail = trails.get(b);
  if (trail && b.dashWave === 0 && b.age % 3 === 0) {
    trail.points[trail.head * 2] = b.x; trail.points[trail.head * 2 + 1] = b.y;
    trail.head = (trail.head + 1) % TAIL_POINTS; trail.count = Math.min(TAIL_POINTS, trail.count + 1);
  }
  const vx = b.vx * Math.cos(b.spin) - b.vy * Math.sin(b.spin);
  b.vy = b.vx * Math.sin(b.spin) + b.vy * Math.cos(b.spin) + b.sway; b.vx = vx;
  b.x += b.vx; b.y += b.vy;
  if (b.releaseAt > 0 && b.age === b.releaseAt) {
    const level = levelOf(game);
    // 余裕がないときも弾は消さず、その場で宝石形へほどく。
    if (game.bullets.count + 2 > RAINBOW_LIMIT[level]) { b.releaseAt = 0; b.dashWave = 1; b.spin = 0; b.radius = 1.8 + level * 0.1; resetTrail(b); }
    else {
      const { x, y, color, gridRow } = b, angle = Math.atan2(b.vy, b.vx);
      b.active = false;
      for (let j = -1; j <= 1; j++) {
        const child = spawnRainbow(game, x, y, angle + j * 0.22, (1.25 + j * 0.06) * RAINBOW_SPEED[level], color, level, true);
        // Poolの再利用順にかかわらず、生成フレームに分離弾を移動・衝突させない。
        if (child) child.delay = 1;
      }
      if (color === 0 && gridRow === 0) game.audio.play('split');
      return true;
    }
  }
  if (b.age > 580 || b.x < -50 || b.x > FIELD.w + 50 || b.y < -30 || b.y > FIELD.h + 30) b.active = false;
  return true;
}

export function drawRainbowBackdrop(c: CanvasRenderingContext2D, game: Game): void {
  if (game.phase?.pattern !== 'rainbow') return;
  const t = Math.max(0, game.phaseFrame - 105);
  c.save(); c.globalAlpha = 0.88; c.fillStyle = '#141221'; c.fillRect(0, 0, FIELD.w, FIELD.h);
  c.strokeStyle = '#e9cca0'; c.lineWidth = 0.7; c.globalAlpha = 0.12;
  const [bx, by] = game.bossPosition();
  for (const radius of [70, 92, 114]) {
    c.beginPath(); c.ellipse(bx, by, radius, radius * 0.65, 0, Math.PI, Math.PI * 2); c.stroke();
  }
  for (let i = 0; i < 30; i++) {
    c.globalAlpha = 0.12 + (1 + Math.sin(t * 0.018 + i * 2.1)) * 0.12;
    c.fillStyle = '#f8dfac'; c.fillRect(16 + i * 137.5 % 352, 54 + (i * 47.3 + t * 0.12) % 210, 1, 1);
  }
  c.restore();
}

// 七色の光跡と弾を色別にまとめる。弾ごとのshadowBlurと毎フレームの配列生成を避ける。
export function drawRainbowBullets(c: CanvasRenderingContext2D, game: Game): void {
  if (game.phase?.pattern !== 'rainbow') return;
  c.save();
  for (let color = 0; color < 7; color++) {
    c.strokeStyle = RAINBOW_COLORS[color]; c.lineWidth = 1.1; c.globalAlpha = 0.27; c.beginPath();
    for (const b of game.bullets.objects) {
      if (!b.active || b.motion !== 'rainbowVeil' || b.color !== color || b.dashWave !== 0) continue;
      const trail = trails.get(b); if (!trail || trail.count < 2) continue;
      const first = (trail.head - trail.count + TAIL_POINTS) % TAIL_POINTS;
      c.moveTo(trail.points[first * 2], trail.points[first * 2 + 1]);
      for (let i = 1; i < trail.count; i++) {
        const index = (first + i) % TAIL_POINTS; c.lineTo(trail.points[index * 2], trail.points[index * 2 + 1]);
      }
      c.lineTo(b.x, b.y);
    }
    c.stroke(); c.fillStyle = RAINBOW_COLORS[color]; c.globalAlpha = 0.12; c.beginPath();
    for (const b of game.bullets.objects) {
      if (!b.active || b.motion !== 'rainbowVeil' || b.color !== color) continue;
      c.moveTo(b.x + 5, b.y); c.arc(b.x, b.y, 5, 0, Math.PI * 2);
    }
    c.fill(); c.globalAlpha = 0.95; c.beginPath();
    for (const b of game.bullets.objects) {
      if (!b.active || b.motion !== 'rainbowVeil' || b.color !== color) continue;
      if (b.dashWave === 1) {
        c.moveTo(b.x, b.y - 3.7); c.lineTo(b.x + 2.4, b.y); c.lineTo(b.x, b.y + 3.7); c.lineTo(b.x - 2.4, b.y); c.closePath();
      } else { const radius = Math.max(2.2, b.radius); c.moveTo(b.x + radius, b.y); c.arc(b.x, b.y, radius, 0, Math.PI * 2); }
    }
    c.fill();
  }
  c.fillStyle = '#fff7e5'; c.globalAlpha = 0.9; c.beginPath();
  for (const b of game.bullets.objects) {
    if (!b.active || b.motion !== 'rainbowVeil') continue;
    c.moveTo(b.x + 0.6, b.y); c.arc(b.x, b.y, 0.6, 0, Math.PI * 2);
  }
  c.fill(); c.restore();
}
