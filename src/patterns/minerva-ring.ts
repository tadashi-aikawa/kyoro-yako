import type { Game } from '../game';
import { FIELD } from '../rules';

export const INTERVIEW_RING_WIDTH = 6;
export interface InterviewRing {
  x: number; y: number; radius: number; speed: number; gap: number; opening: number;
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

export function updateInterviewRings(game: Game): void {
  for (let i = game.interviewRings.length - 1; i >= 0; i--) {
    const ring = game.interviewRings[i];
    if (ring.delay > 0) { ring.delay--; continue; }
    if (!ring.launched) { ring.launched = true; game.audio.play('enemyShot'); }
    ring.radius += ring.speed;
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
