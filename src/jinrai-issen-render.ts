import type { Game } from './game';
import { DASH_MOVE, ISSEN_BREAK, issenCenter, issenScene } from './patterns/jinrai-issen';

// 予告は細線、攻撃は白い芯、通過後は薄い残光に分ける。
export function drawIssen(ctx: CanvasRenderingContext2D, game: Game): void {
  const state = game.jinraiIssen, scene = issenScene(game);
  if (!state || !scene) return;
  const c = ctx, [mx, my] = issenCenter(state), t = scene.elapsed;
  const from = state.origin, to = state.end;
  c.save(); c.lineCap = 'round';
  if (scene.warning) {
    c.strokeStyle = '#ffe7a0'; c.globalAlpha = 0.45 + scene.progress * 0.3; c.lineWidth = 1;
    c.setLineDash([7, 5]); c.beginPath(); c.moveTo(...from); c.lineTo(...to); c.stroke(); c.setLineDash([]);
  }
  if (t >= 0 && t < ISSEN_BREAK + 28) {
    const moving = t <= DASH_MOVE;
    const end = moving ? scene.position : to;
    const fade = moving ? 1 : Math.max(0, 1 - (t - DASH_MOVE) / (ISSEN_BREAK + 20));
    c.globalAlpha = fade * (moving ? 0.5 : 0.24);
    c.strokeStyle = '#ffd22d'; c.lineWidth = moving ? 20 : 9;
    c.beginPath(); c.moveTo(...from); c.lineTo(...end); c.stroke();
    c.globalAlpha = fade * (moving ? 1 : 0.45); c.lineWidth = moving ? 5 : 1.5;
    c.strokeStyle = moving ? '#fffde4' : '#efc46f'; c.stroke();
    if (t >= DASH_MOVE && t < ISSEN_BREAK && !state.cancelled) {
      const p = (t - DASH_MOVE) / (ISSEN_BREAK - DASH_MOVE);
      const glow = c.createRadialGradient(mx, my, 0, mx, my, 9 + p * 26);
      glow.addColorStop(0, '#fffce4'); glow.addColorStop(0.25, '#ffe175bb'); glow.addColorStop(1, '#ffe17500');
      c.globalAlpha = 1; c.fillStyle = glow; c.beginPath(); c.arc(mx, my, 9 + p * 26, 0, Math.PI * 2); c.fill();
    }
  }
  const burst = t - ISSEN_BREAK;
  if (!state.cancelled && burst >= 0 && burst < 38) {
    c.globalAlpha = (1 - burst / 38) * 0.8;
    // 中点から伸びる枝だけを光らせ、画面全体は白く塗らない。
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5 + state.cycle * 0.4;
      c.beginPath(); c.moveTo(mx, my);
      for (let j = 1; j <= 6; j++) {
        const radius = j * (12 + Math.min(burst, 12) * 1.8);
        const bend = Math.sin(i * 7 + j * 4 + Math.floor(burst / 3)) * 12;
        c.lineTo(mx + Math.cos(angle) * radius - Math.sin(angle) * bend, my + Math.sin(angle) * radius + Math.cos(angle) * bend);
      }
      c.strokeStyle = '#f8d055'; c.lineWidth = 3; c.stroke();
      c.strokeStyle = '#fff6c9'; c.lineWidth = 1; c.stroke();
    }
    c.globalAlpha *= 0.55; c.strokeStyle = '#ffe9aa'; c.lineWidth = 2;
    c.beginPath(); c.arc(mx, my, 12 + burst * 4.5, 0, Math.PI * 2); c.stroke();
  }
  c.restore();
}
