import type { Game } from './game';
import { jinraiCloneScene } from './patterns/jinrai-clone';
import { REPRISE_FINAL_HP } from './patterns/minerva-reprise';
import { FIELD } from './rules';

export function drawMinervaAura(c: CanvasRenderingContext2D, game: Game): void {
  if (game.boss !== 'minerva' || game.phase?.pattern !== 'owlDawn' || game.phaseIntro
    || game.phaseHp <= 0 || game.phaseHp > game.phaseMaxHp * REPRISE_FINAL_HP) return;
  const attack = game.attackContext();
  const opacity = attack.phase?.pattern === 'jinraiClone' && attack.phaseFrame >= 105
    ? jinraiCloneScene(attack.phaseFrame, attack.phase.duration).bodies[0].opacity : 1;
  if (opacity <= 0) return;
  const [x, y] = game.bossXY, frame = game.phaseFrame;
  const breath = 0.9 + Math.sin(frame * 0.075) * 0.1;
  c.save();
  // HP表示へ漏らさず、本体と弾の背面にだけ描く。ポーズ中は戦闘時計ごと止まる。
  c.beginPath(); c.rect(0, 36, FIELD.w, FIELD.h - 36); c.clip();
  c.translate(x, y - 10); c.scale(1, 1.35); c.globalAlpha = opacity;
  c.save(); c.scale(breath, 1);
  const glow = c.createRadialGradient(0, 4, 8, 0, 4, 58);
  glow.addColorStop(0, '#fff1c58a'); glow.addColorStop(0.45, '#ffd26b55');
  glow.addColorStop(0.78, '#a486ff30'); glow.addColorStop(1, '#9d76ef00');
  c.fillStyle = glow; c.beginPath(); c.ellipse(0, 4, 58, 58, 0, 0, Math.PI * 2); c.fill();
  c.restore();
  // 炎状の光を上へ伸ばす。独立した光粒や弾に似た点は置かない。
  for (let i = 0; i < 11; i++) {
    const rise = (frame * 0.009 + i * 0.381966) % 1;
    const side = i % 2 ? -1 : 1;
    const baseX = side * (17 + i % 3 * 7), baseY = 29 - rise * 12;
    const tipX = baseX + Math.sin(frame * 0.055 + i * 2.1) * 11;
    const tipY = baseY - 42 - rise * 38;
    const width = (5 + i % 3 * 2) * (1 - rise * 0.5);
    c.globalAlpha = opacity * Math.sin(rise * Math.PI) * 0.65;
    const flame = c.createLinearGradient(0, tipY, 0, baseY + 5);
    flame.addColorStop(0, '#fff8dc00'); flame.addColorStop(0.2, '#fff8dc');
    flame.addColorStop(0.55, i % 3 ? '#ffe3a2' : '#d6beff'); flame.addColorStop(1, '#ffe3a200');
    c.fillStyle = flame;
    c.beginPath(); c.moveTo(baseX, baseY + 5);
    c.bezierCurveTo(baseX - width * 2, baseY - 6, tipX + side * 12, tipY + 19, tipX, tipY);
    c.bezierCurveTo(tipX + side * 3, tipY + 24, baseX + width * 2, baseY - 8, baseX, baseY + 5);
    c.closePath(); c.fill();
    c.globalAlpha *= 0.8; c.strokeStyle = flame; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(baseX, baseY - 5);
    c.bezierCurveTo(baseX - side * 8, baseY - 24, tipX + side * 9, tipY + 19, tipX, tipY); c.stroke();
  }
  c.restore();
}
