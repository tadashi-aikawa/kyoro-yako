import type { Game } from '../game';
import { FIELD } from '../rules';

export const INTERVIEW_RING_WIDTH = 6;
export interface InterviewRing {
  x: number; y: number; radius: number; speed: number; gap: number; opening: number; spin: number;
  color: number; delay: number; launched: boolean; grazed: boolean;
}

// 穴の中では端点まで、それ以外では円周までの最短距離を使う。
// 描画と同じ連続した円弧なので、個別弾の隙間や見えない当たり判定を作らない。
export function interviewRingDistance(ring: InterviewRing, x: number, y: number): number {
  const dx = x - ring.x; const dy = y - ring.y;
  const angle = Math.atan2(dy, dx) - ring.gap;
  const relative = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
  if (relative >= ring.opening / 2) return Math.abs(Math.hypot(dx, dy) - ring.radius);
  const endpoint = ring.gap + (Math.atan2(Math.sin(angle), Math.cos(angle)) < 0 ? -1 : 1) * ring.opening / 2;
  return Math.hypot(dx - Math.cos(endpoint) * ring.radius, dy - Math.sin(endpoint) * ring.radius);
}

export function interviewRingBlocksShot(ring: InterviewRing, fromX: number, fromY: number, toX: number, toY: number, radius: number): boolean {
  if (!ring.launched || ring.delay > 0) return false;
  const padding = INTERVIEW_RING_WIDTH / 2 + radius;
  const dx = toX - fromX; const dy = toY - fromY;
  const length2 = dx * dx + dy * dy;
  const at = (t: number): boolean => interviewRingDistance(ring, fromX + dx * t, fromY + dy * t) <= padding;
  if (at(0) || at(1)) return true;
  if (length2 === 0) return false;
  const clamp = (t: number): number => Math.max(0, Math.min(1, t));
  const cx = fromX - ring.x; const cy = fromY - ring.y;
  const dot = cx * dx + cy * dy;
  if (at(clamp(-dot / length2))) return true;
  // 点だけでなく移動区間を調べ、高速ショットが輪を飛び越えるのを防ぐ。
  const discriminant = dot * dot - length2 * (cx * cx + cy * cy - ring.radius * ring.radius);
  if (discriminant >= 0) {
    const root = Math.sqrt(discriminant);
    for (const t of [(-dot - root) / length2, (-dot + root) / length2]) {
      if (t >= 0 && t <= 1 && at(t)) return true;
    }
  }
  // 丸い線端は、端点からショットの移動区間までの最短距離で判定する。
  for (const side of [-1, 1]) {
    const angle = ring.gap + side * ring.opening / 2;
    const x = ring.x + Math.cos(angle) * ring.radius;
    const y = ring.y + Math.sin(angle) * ring.radius;
    const t = clamp(((x - fromX) * dx + (y - fromY) * dy) / length2);
    if (Math.hypot(fromX + dx * t - x, fromY + dy * t - y) <= padding) return true;
  }
  return false;
}

export function updateInterviewRings(game: Game): void {
  for (let i = game.interviewRings.length - 1; i >= 0; i--) {
    const ring = game.interviewRings[i];
    if (ring.delay > 0) { ring.delay--; continue; }
    if (!ring.launched) { ring.launched = true; game.triggerBossCast(); game.audio.play('enemyShot'); }
    ring.radius += ring.speed;
    ring.gap += ring.spin;
    const farthest = Math.hypot(Math.max(ring.x, FIELD.w - ring.x), Math.max(ring.y, FIELD.h - ring.y));
    if (ring.radius > farthest + 25) { game.interviewRings.splice(i, 1); continue; }
    if (game.invulnFrames > 0 || game.invincible || game.pendingHit >= 0) continue;
    const distance = interviewRingDistance(ring, game.px, game.py);
    if (distance <= INTERVIEW_RING_WIDTH / 2 + 2.5) {
      game.pendingHit = 0; game.hitDuringSpell = true;
    } else if (!ring.grazed && distance <= INTERVIEW_RING_WIDTH / 2 + 18) {
      ring.grazed = true; game.grazeAt(game.px, game.py);
    }
  }
}
