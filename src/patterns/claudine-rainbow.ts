import type { Bullet, Game } from '../game';
import { FIELD } from '../rules';

export const RAINBOW_COLORS = ['#ff7c96', '#ffb47a', '#ffe799', '#a3e6a4', '#81dff0', '#9aa9ff', '#dba3f0'] as const;
export const RAINBOW_PERIOD = [180, 156, 144, 144] as const;
export const RAINBOW_SPEED = [0.85, 1, 1.12, 1.24] as const;
export const RAINBOW_WARNING = [90, 72, 60, 48] as const;
export const RAINBOW_GAP = [104, 92, 82, 74] as const;
const GAPS = [192, 132, 240, 156, 252, 144, 216, 192] as const;

function drift(age: number, wave: number): number {
  return (Math.sin(age * 0.006 + wave * 0.7) - Math.sin(wave * 0.7)) * 9;
}

export function rainbowGap(wave: number, age: number): number {
  return GAPS[wave % GAPS.length] + drift(age, wave);
}

export function rainbowBossPosition(t: number, level: number): [number, number] {
  // 下部の切れ目をたどる射線へ、ショットが届く時間だけ遅れて入る。
  const clock = Math.max(0, t - 26), period = RAINBOW_PERIOD[level];
  const position = Math.max(0, (clock - RAINBOW_WARNING[level] - 453 / RAINBOW_SPEED[level] + period / 2) / period);
  const wave = Math.floor(position);
  const progress = Math.min(1, (position - wave) * period / 84);
  const eased = progress * progress * (3 - 2 * progress);
  const from = wave === 0 ? 192 : rainbowGap(wave - 1, Math.max(0, clock - (wave - 1) * period - RAINBOW_WARNING[level]));
  const to = rainbowGap(wave, Math.max(0, clock - wave * period - RAINBOW_WARNING[level]));
  return [from + (to - from) * eased, 132 + Math.sin(t * 0.008) * 8];
}

export function emitRainbow(game: Game, t: number): void {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  if (t < 0 || t % RAINBOW_PERIOD[level] !== 0) return;
  const wave = Math.floor(t / RAINBOW_PERIOD[level]);
  const spacing = [16, 14, 12, 11][level];
  const gap = rainbowGap(wave, 0);
  let launchPending = true;
  // 七色を同じ切れ目で抜く。色ごとに穴をずらして抜け道を塞がない。
  for (let color = 0; color < RAINBOW_COLORS.length; color++) {
    // 色を半列ずつずらし、列の間に縦の通路を作らない。左右の揺れぶんも場外から補う。
    for (let column = 0, x = -24 + color % 2 * spacing / 2; x <= FIELD.w + 24; column++, x += spacing) {
      if (Math.abs(x - gap) < RAINBOW_GAP[level] / 2) continue;
      const curve = (x - FIELD.w / 2) / 230;
      const y = -34 + 100 * (1 - Math.sqrt(Math.max(0, 1 - curve * curve))) - (6 - color) * 7;
      const b = game.spawnBullet(x, y, 0, RAINBOW_SPEED[level], color, 'orb');
      if (!b) continue;
      b.motion = 'rainbowVeil'; b.targetX = x; b.targetY = y; b.gridColumn = wave; b.gridRow = column;
      b.radius = 2.1; b.delay = RAINBOW_WARNING[level]; b.releaseAt = b.delay;
      b.launchSoundPending = launchPending && x >= 0 && x <= FIELD.w;
      if (b.launchSoundPending) launchPending = false;
    }
  }
}

export function updateRainbowBullet(b: Bullet): boolean {
  if (b.motion !== 'rainbowVeil') return false;
  const t = Math.max(0, b.age - b.releaseAt);
  b.x = b.targetX + drift(t, b.gridColumn);
  // xごとに位相をずらしてアーチ自体をうねらせる。縦方向の振動速度は下降速度を下回る。
  const phase = b.targetX * -0.028 + b.gridColumn * 0.65;
  const ripple = (Math.sin(t * 0.03 + phase) - Math.sin(phase)) * 6;
  b.y = b.targetY + t * b.vy + Math.sin(t * 0.008) * 5 + ripple;
  if (b.y > FIELD.h + 24) b.active = false;
  return true;
}

export function drawRainbowBackdrop(c: CanvasRenderingContext2D, game: Game): void {
  if (game.phase?.pattern !== 'rainbow') return;
  const t = Math.max(0, game.phaseFrame - 105);
  c.save(); c.globalAlpha = 0.88; c.fillStyle = '#141322'; c.fillRect(0, 0, FIELD.w, FIELD.h);
  // 光は上部の背景へ沈める。弾の白い芯と切れ目が最も明るく見えるようにする。
  c.strokeStyle = '#e9cca0'; c.lineWidth = 0.7; c.globalAlpha = 0.12;
  for (const radius of [92, 110, 132]) {
    c.beginPath(); c.ellipse(192, 132, radius, radius * 0.65, 0, Math.PI, Math.PI * 2); c.stroke();
  }
  for (let i = 0; i < 30; i++) {
    c.globalAlpha = 0.12 + (1 + Math.sin(t * 0.018 + i * 2.1)) * 0.12;
    const x = 16 + i * 137.5 % 352, y = 54 + (i * 47.3 + t * 0.12) % 210;
    c.fillStyle = '#f8dfac'; c.fillRect(x, y, 1, 1);
  }
  // 生成直後のアーチは画面外にある。次の切れ目の両端をHUDより下の光の柱で予告する。
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const waves = new Set<number>();
  game.bullets.forEach(b => { if (b.motion === 'rainbowVeil' && b.delay > 0) waves.add(b.gridColumn); });
  c.globalAlpha = 0.7; c.lineWidth = 1.4;
  for (const wave of waves) for (const side of [-1, 1]) {
    const x = rainbowGap(wave, 0) + side * RAINBOW_GAP[level] / 2;
    for (let color = 0; color < RAINBOW_COLORS.length; color++) {
      c.strokeStyle = RAINBOW_COLORS[color];
      c.beginPath(); c.moveTo(x, 176 + color * 4); c.lineTo(x, 179 + color * 4); c.stroke();
    }
  }
  c.restore();
}

// 色ごとにパスをまとめ、弾ごとのshadowBlur・グラデーション生成を避ける。
export function drawRainbowBullets(c: CanvasRenderingContext2D, game: Game): void {
  if (game.phase?.pattern !== 'rainbow') return;
  c.save();
  for (let color = 0; color < RAINBOW_COLORS.length; color++) {
    c.fillStyle = RAINBOW_COLORS[color];
    for (const preview of [true, false]) {
      for (const glow of [true, false]) {
        c.globalAlpha = preview ? glow ? 0.04 : 0.22 : glow ? 0.14 : 0.95;
        const radius = glow ? 4.8 : 2.4;
        c.beginPath();
        for (const b of game.bullets.objects) {
          if (!b.active || b.motion !== 'rainbowVeil' || b.color !== color || (b.delay > 0) !== preview) continue;
          c.moveTo(b.x + radius, b.y); c.arc(b.x, b.y, radius, 0, Math.PI * 2);
        }
        c.fill();
      }
    }
  }
  c.fillStyle = '#fff8e8'; c.globalAlpha = 0.9; c.beginPath();
  for (const b of game.bullets.objects) {
    if (!b.active || b.motion !== 'rainbowVeil' || b.delay > 0) continue;
    c.moveTo(b.x + 0.7, b.y); c.arc(b.x, b.y, 0.7, 0, Math.PI * 2);
  }
  c.fill(); c.restore();
}
