import type { Bullet } from './game';
import { CAROM_WARNING, SUGAR_CUE, YOYO_BEADS, YOYO_FLIGHT, YOYO_STAGGER, YOYO_WARNING, yoyoPoint, yoyoStep } from './patterns/chappy';

// 専用弾は輪郭と芯だけで描く。発光用のshadowBlurを弾数ぶん実行しない。
export function drawChappyBullet(c: CanvasRenderingContext2D, b: Bullet): boolean {
  if (b.motion !== 'chappyYoyo' && b.motion !== 'chappyStitch' && b.motion !== 'chappySugar') return false;
  const color = b.color === 1 ? '#a6f1e1' : '#ffc0d7';
  c.save();
  if (b.motion === 'chappyStitch') {
    const palette = ['#f6c65c', '#93c9f1', '#f4a5c1', '#b9a4eb', '#89d5bb'];
    const tint = palette[b.gridRow % palette.length], ready = b.age >= CAROM_WARNING;
    c.globalAlpha = ready ? 1 : 0.45 + b.age / CAROM_WARNING * 0.45;
    c.strokeStyle = tint; c.lineWidth = 1.4;
    const scale = ready ? -7 : 26 / Math.hypot(b.vx, b.vy);
    if (b.swayPhase === 0) { c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x + b.vx * scale, b.y + b.vy * scale); c.stroke(); }
    c.fillStyle = tint; c.strokeStyle = '#fff8e8';
    c.beginPath(); c.arc(b.x, b.y, b.radius + 1, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#fff8e8'; c.beginPath(); c.arc(b.x, b.y, 4.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#393248'; c.font = 'bold 7px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(b.gridRow % 9 + 1), b.x, b.y + 0.4);
    if (b.swayPhase > 0) {
      c.globalAlpha = b.swayPhase / 10; c.strokeStyle = '#fff8e8';
      c.beginPath(); c.arc(b.x, b.y, b.radius + 2 + (10 - b.swayPhase) * 0.7, 0, Math.PI * 2); c.stroke();
    }
    c.restore(); return true;
  }
  if (b.motion === 'chappyYoyo') {
    const step = yoyoStep(b), warning = YOYO_WARNING[b.dashWave], flight = YOYO_FLIGHT[b.dashWave];
    if (b.gridRow === 0 && step < warning + flight + (YOYO_BEADS - 1) * YOYO_STAGGER) {
      c.strokeStyle = color; c.globalAlpha = step < warning ? 0.32 : 0.13; c.lineWidth = 0.8;
      c.setLineDash(step < warning ? [3, 5] : []); c.beginPath();
      for (let i = 0; i <= 36; i++) { const [x, y] = yoyoPoint(b, i / 36); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke(); c.setLineDash([]);
      const [x, y] = yoyoPoint(b, 0.5);
      c.globalAlpha = 0.7; c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.stroke();
    }
    if (step <= warning || step >= warning + flight) { c.restore(); return true; }
    c.globalAlpha = 1;
  }
  if (b.motion === 'chappySugar' && b.age < b.releaseAt) {
    const cue = b.releaseAt - b.age <= SUGAR_CUE;
    c.globalAlpha = Math.min(0.75, b.age / 24);
    c.strokeStyle = cue ? '#fff4d8' : color; c.lineWidth = 1.2;
    c.beginPath(); c.arc(b.x, b.y, 5, 0, Math.PI * 2); c.stroke();
    if (cue) {
      const a = Math.atan2(b.targetY, b.targetX), dx = Math.cos(a), dy = Math.sin(a);
      c.globalAlpha = 0.95;
      c.beginPath(); c.moveTo(b.x + dx * 8, b.y + dy * 8); c.lineTo(b.x + dx * 25, b.y + dy * 25);
      c.moveTo(b.x + dx * 18 - dy * 3, b.y + dy * 18 + dx * 3); c.lineTo(b.x + dx * 25, b.y + dy * 25); c.lineTo(b.x + dx * 18 + dy * 3, b.y + dy * 18 - dx * 3); c.stroke();
    }
    c.restore(); return true;
  }
  if (b.motion === 'chappySugar') {
    const speed = Math.hypot(b.vx, b.vy);
    c.strokeStyle = color; c.globalAlpha = 0.55; c.lineWidth = 2;
    c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - b.vx / speed * 15, b.y - b.vy / speed * 15); c.stroke(); c.globalAlpha = 1;
  }
  c.fillStyle = color; c.strokeStyle = '#fff9ed'; c.lineWidth = 1;
  const radius = b.motion === 'chappyYoyo' && b.gridRow === 0 ? 7 : b.radius + 1;
  c.beginPath(); c.arc(b.x, b.y, radius, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#fffdf2'; c.beginPath(); c.arc(b.x - 0.8, b.y - 1, Math.max(1.2, b.radius * 0.45), 0, Math.PI * 2); c.fill();
  c.restore(); return true;
}
