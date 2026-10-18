import type { Bullet, Game } from '../game';

export const STAR_FLIGHT_PERIOD = 480;
export const STAR_FLIGHT_TIME = 288;
export const STAR_TRAIL_WARNING = 48;
export const STAR_TRAIL_SPACING = [12, 10, 8, 7] as const;
export const STAR_TRAIL_SPEED = [0.95, 1.15, 1.35, 1.5] as const;

// 発射時の手元から離れ、左右を替えながら画面下寄りまで大きく旋回する。
// 原点は発射時に固定し、自機や移動中のボスへ追従させない。
export function starFlightPoint(age: number, originX: number, originY: number, side: number, wave: number): [number, number] {
  const q = Math.max(0, Math.min(1, age / STAR_FLIGHT_TIME));
  const angle = q * Math.PI * 2 * (wave % 2 ? 1.25 : 1.05);
  const drift = (originX - 192) * (1 - q) ** 3;
  // 発射点が端寄りでも振れ幅を滑らかに抑える。端で座標を切ると飛行が貼り付く。
  const span = 132 * (1 - Math.abs(drift) / 168);
  const x = 192 + drift + side * Math.sin(angle) * span;
  const y = originY + (350 - originY) * q + Math.sin(q * Math.PI * 4) * 34;
  return [x, y];
}

export function emitStarFlight(game: Game): void {
  if (game.bombFrames > 0) return;
  const duration = game.phase?.duration ?? 60;
  const pairStart = (duration - 45) * 60;
  const thirdStart = (duration - 20) * 60;
  // 2羽への切替では周期を揃え直す。3羽目は既存の飛行を続けたまま手元から加える。
  const starts = [game.phaseFrame < pairStart ? 105 : pairStart, pairStart, thirdStart];
  const [x, y] = game.bossPosition();
  let launched = false;
  for (let slot = 0; slot < starts.length; slot++) {
    const t = game.phaseFrame - starts[slot];
    if (t < 0 || t % STAR_FLIGHT_PERIOD !== 0) continue;
    const wave = Math.floor(t / STAR_FLIGHT_PERIOD);
    const owl = game.spawnBullet(x + 16, y - 6, 0, 0, slot === 1 ? 0 : 2, 'star');
    if (!owl) continue;
    Object.assign(owl, { motion: 'starOwl', radius: 0, targetX: x + 16, targetY: y - 6,
      gridColumn: slot, gridRow: wave, sway: (wave + slot) % 2 ? -1 : 1, launchSoundPending: false });
    launched = true;
  }
  if (launched) { game.triggerBossCast(); game.audio.play('wind'); }
}

// 発射源は接触判定・画面外削除へ進ませない。ボムや技終了では弾プールごと消える。
export function updateStarFlightSource(game: Game, owl: Bullet): boolean {
  if (owl.motion !== 'starOwl') return false;
  const elapsed = owl.age - 1;
  if (elapsed >= STAR_FLIGHT_TIME) { owl.active = false; return true; }
  const [x, y] = starFlightPoint(elapsed, owl.targetX, owl.targetY, owl.sway, owl.gridRow);
  owl.rotation = Math.max(-0.45, Math.min(0.45, (x - owl.x) * 0.12));
  owl.x = x; owl.y = y;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const spacing = STAR_TRAIL_SPACING[level];
  if (elapsed % spacing !== 0 && elapsed !== STAR_FLIGHT_TIME - 1) return true;
  const [nextX, nextY] = starFlightPoint(elapsed + 1, owl.targetX, owl.targetY, owl.sway, owl.gridRow);
  const length = Math.hypot(nextX - x, nextY - y) || 1;
  const normalX = -(nextY - y) / length;
  const normalY = (nextX - x) / length;
  const previousAge = Math.max(0, elapsed - (elapsed % spacing || spacing));
  const previous = starFlightPoint(previousAge, owl.targetX, owl.targetY, owl.sway, owl.gridRow);
  for (const side of [-1, 1]) {
    const feather = game.spawnBullet(x, y, normalX * STAR_TRAIL_SPEED[level] * side, normalY * STAR_TRAIL_SPEED[level] * side, owl.color, 'petal');
    if (feather) Object.assign(feather, { motion: 'starTrail', radius: 3.2,
      delay: STAR_TRAIL_WARNING, releaseAt: STAR_TRAIL_WARNING,
      targetX: previous[0], targetY: previous[1], sway: side, gridRow: Math.floor(elapsed / spacing), launchSoundPending: false });
  }
  return true;
}
