import type { Bullet, Game } from './game';
import { bloomArena, bloomLayout, bloomOpacity, bloomPoint, bloomTrail, FINALE_CHARGE, finaleTime } from './patterns/claudine-finale';
import { FIELD } from './rules';

const COLORS = ['#ff8f9e', '#8ddce9', '#ffe3a1', '#f5ad77', '#e9a7da', '#eee6cd'];

export function drawBloomBackdrop(c: CanvasRenderingContext2D, game: Game): void {
  const t = finaleTime(game);
  if (t < 0) return;
  const arena = bloomArena(t), layout = bloomLayout(t);
  c.save();
  c.fillStyle = '#090b1b'; c.globalAlpha = 0.94 * Math.min(1, t / 45);
  c.fillRect(0, 0, FIELD.w, FIELD.h);
  c.beginPath(); c.rect(0, 44, FIELD.w, FIELD.h - 44); c.clip();
  // 静かな星空の上に、弾そのものの光を主役として置く。
  c.fillStyle = '#d8c7b3';
  for (let i = 0; i < 45; i++) {
    c.globalAlpha = (0.08 + (1 + Math.sin(t * 0.018 + i * 2.3)) * 0.08) * Math.min(1, t / 60);
    const [x, y] = bloomPoint(arena, (i * 137.5) % 384, (i * 79.7) % 448);
    c.fillRect(x, y, i % 7 === 0 ? 1.5 : 0.8, i % 7 === 0 ? 1.5 : 0.8);
  }
  c.globalAlpha = 0.75; c.strokeStyle = '#e1c597'; c.lineWidth = 0.8;
  c.strokeRect(arena.x, arena.y, arena.w, arena.h);
  // エリアの四隅に、ブラウザのリサイズを思わせる短い二重のハンドルを置く。
  for (const [x, y, sx, sy] of [[arena.x, arena.y, 1, 1], [arena.x + arena.w, arena.y, -1, 1], [arena.x, arena.y + arena.h, 1, -1], [arena.x + arena.w, arena.y + arena.h, -1, -1]]) {
    c.beginPath(); c.moveTo(x, y + sy * 13); c.lineTo(x, y); c.lineTo(x + sx * 13, y); c.stroke();
    c.globalAlpha = 0.25; c.beginPath(); c.moveTo(x + sx * 4, y + sy * 13); c.lineTo(x + sx * 4, y + sy * 4); c.lineTo(x + sx * 13, y + sy * 4); c.stroke(); c.globalAlpha = 0.75;
  }
  if (layout.warning) {
    const a = layout.target;
    c.globalAlpha = 0.25 + Math.sin(t * 0.1) * 0.08;
    c.setLineDash([3, 7]); c.strokeRect(a.x, a.y, a.w, a.h); c.setLineDash([]);
  }
  if (t < FINALE_CHARGE) {
    const [bx, by] = game.bossXY;
    const x = bx - 22, y = by - 10;
    const p = t / FINALE_CHARGE;
    c.globalAlpha = Math.sin(p * Math.PI) * 0.6;
    c.beginPath(); c.ellipse(x, y + 2, 30 + p * 110, 12 + p * 30, -0.2, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + p * 2;
      c.fillStyle = '#ffe2ab'; c.beginPath(); c.arc(x + Math.cos(a) * (18 + p * 90), y + Math.sin(a) * (12 + p * 30), 1.5, 0, Math.PI * 2); c.fill();
    }
  }
  c.restore();
}

export function drawBloomBullet(c: CanvasRenderingContext2D, game: Game, b: Bullet): boolean {
  if (b.motion !== 'bloomRocket' && b.motion !== 'bloomSpark') return false;
  const arena = bloomArena(finaleTime(game));
  c.save(); c.beginPath(); c.rect(arena.x, arena.y, arena.w, arena.h); c.clip();
  const rocket = b.motion === 'bloomRocket';
  const color = COLORS[b.color % COLORS.length];
  const fade = rocket ? 1 : bloomOpacity(b);
  c.globalCompositeOperation = 'lighter';
  const angle = rocket ? -Math.PI / 2 : b.rotation;
  const length = rocket ? b.dashWave === 2 ? 65 : 30 : b.delay > 0 ? 0 : Math.min(28, (b.age - 18) * 0.7, 12 + b.gridRow * 10);
  c.strokeStyle = color; c.lineWidth = rocket ? 1.2 : 1.1;
  const trail = b.dashWave === 2 && !rocket ? bloomTrail(b) : [];
  if (trail.length > 1) {
    const [x, y] = bloomPoint(arena, trail[0][0], trail[0][1]);
    const glow = c.createLinearGradient(x, y, b.x, b.y);
    glow.addColorStop(0, `${color}00`); glow.addColorStop(0.45, `${color}36`); glow.addColorStop(1, `${color}b0`);
    c.strokeStyle = glow; c.globalAlpha = fade * 0.7;
    c.beginPath(); c.moveTo(x, y);
    for (const point of trail) { const [px, py] = bloomPoint(arena, point[0], point[1]); c.lineTo(px, py); }
    c.lineTo(b.x, b.y); c.stroke();
  }
  // 柳は実際の軌跡を長く残し、それ以外は短い尾で弾の芯を読みやすくする。
  for (let i = 3; i > 0 && trail.length <= 1; i--) {
    c.globalAlpha = fade * (4 - i) * 0.09;
    c.beginPath(); c.moveTo(b.x - Math.cos(angle) * length * i / 3, b.y - Math.sin(angle) * length * i / 3);
    c.lineTo(b.x - Math.cos(angle) * length * (i - 1) / 3, b.y - Math.sin(angle) * length * (i - 1) / 3); c.stroke();
  }
  c.globalAlpha = fade * 0.09; c.fillStyle = color;
  c.beginPath(); c.arc(b.x, b.y, rocket ? 6 : 5.5, 0, Math.PI * 2); c.fill();
  c.globalAlpha = fade; c.fillStyle = color;
  c.beginPath(); c.arc(b.x, b.y, rocket ? 1.6 : 2.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff5de'; c.beginPath(); c.arc(b.x, b.y, 0.9, 0, Math.PI * 2); c.fill();
  if (!rocket && b.dashWave === 2 && b.gridColumn === 0 && b.gridRow === 0 && b.age < 36) {
    const center = trail[0];
    if (center) {
      const [x, y] = bloomPoint(arena, center[0], center[1]);
      c.globalAlpha = (1 - b.age / 36) * 0.3; c.strokeStyle = '#ffe5ad'; c.lineWidth = 1.3;
      c.beginPath(); c.arc(x, y, 12 + b.age * 5, 0, Math.PI * 2); c.stroke();
    }
  }
  c.restore(); return true;
}
