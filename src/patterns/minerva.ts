import type { Game } from '../game';
import { DIFFICULTY, density } from '../rules';
import { emitDawn } from './minerva-dawn';
import { emitStarFlight } from './minerva-flight';
import { emitGravity, emitSocratic } from './minerva-inquiry';

export { dawnPosition, dawnPrayerStep, PRAYER_CHARGE, PRAYER_FIRE, PRAYER_PERIOD } from './minerva-dawn';
export const MINERVA_WARNING = [90, 70, 55, 42] as const;
export const SEVEN_PERIOD = [540, 450, 390, 360] as const;
export const EYE_PERIOD = 240;
export const INTERVIEW_PERIOD = [330, 300, 270, 240] as const;
export const INTERVIEW_SPEED = [0.5, 0.6, 0.7, 0.8] as const;
export const INTERVIEW_SPIN = [0.003, 0.0036, 0.0042, 0.0048] as const;
const INTERVIEW_GAP = [0.62, 0.54, 0.46, 0.4] as const;
const INTERVIEW_STOPS = [[192, 132], [272, 104], [136, 182], [256, 164], [112, 102], [218, 82]] as const;

export function interviewPosition(frame: number, level: number): [number, number] {
  const t = Math.max(0, frame - 105);
  const period = INTERVIEW_PERIOD[level];
  const wave = Math.floor(t / period);
  const from = INTERVIEW_STOPS[wave % INTERVIEW_STOPS.length];
  const to = INTERVIEW_STOPS[(wave + 1) % INTERVIEW_STOPS.length];
  // 発射の前後だけ一拍止まり、次の発射までに自機と無関係な観測点へ移る。
  const progress = Math.max(0, Math.min(1, (t % period - 18) / (period - 36)));
  const ease = progress * progress * (3 - 2 * progress);
  return [from[0] + (to[0] - from[0]) * ease, from[1] + (to[1] - from[1]) * ease];
}
export function eyeX(t: number): number {
  const step = ((t % EYE_PERIOD) + EYE_PERIOD) % EYE_PERIOD;
  return step < 120 ? 32 + step * 320 / 120 : 352 - (step - 120) * 320 / 120;
}

export function emitMinerva(game: Game, pattern: string): void {
  if (pattern === 'question') { emitSocratic(game); return; }
  if (pattern === 'gravityShift') { emitGravity(game); return; }
  if (pattern === 'owlDawn') { emitDawn(game); return; }
  const t = game.phaseFrame - 105;
  const [x, y] = game.bossPosition();
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const unit = 0.9 + (DIFFICULTY[game.difficulty] - 1) * 0.18;
  const count = (n: number) => density(game.difficulty, n);
  const warning = MINERVA_WARNING[level];
  if (pattern === 'sevenRings' && t % SEVEN_PERIOD[level] === 0) {
    const wave = Math.floor(t / SEVEN_PERIOD[level]);
    for (let layer = 0; layer < 7; layer++) {
      const radius = 76 + layer * 18;
      const n = count(20 + layer * 2);
      const direction = layer % 2 ? -1 : 1;
      const gap = (wave * 3 + layer * 4) % n;
      for (let i = 0; i < n; i++) {
        if ((i - gap + n) % n < 2) continue;
        const angle = i * Math.PI * 2 / n + layer * 0.14 + wave * 0.37;
        const b = game.spawnBullet(192 + Math.cos(angle) * radius, 220 + Math.sin(angle) * radius,
          -Math.cos(angle) * 0.45 * unit - Math.sin(angle) * direction * 0.17 * unit,
          -Math.sin(angle) * 0.45 * unit + Math.cos(angle) * direction * 0.17 * unit, layer % 4, 'orb');
        if (b) { b.motion = 'minervaRing'; b.delay = warning; b.spin = direction * 0.003;
          b.releaseAt = warning + [120, 96, 80, 64][level]; b.swayPhase = angle; }
      }
    }
  }
  if (pattern === 'owlEye' && t % [42, 32, 26, 22][level] === 0) {
    const n = [8, 12, 15, 18][level];
    const row = Math.floor(t / [42, 32, 26, 22][level]);
    for (let i = 0; i < n; i++) {
      if (i === row % n) continue;
      const stagger = Math.sin(row * 1.1) * 366 / (n - 1) * 0.42;
      const bx = Math.max(9, Math.min(375, 9 + i * 366 / (n - 1) + stagger));
      const b = game.spawnBullet(bx, 36, 0, [1.15, 1.5, 1.8, 2.1][level], i % 2 ? 1 : 2, 'orb');
      if (b) { b.motion = 'eyeFreeze'; b.delay = warning; b.radius = 4; }
    }
  }
  if (pattern === 'recall' && t % [480, 420, 390, 360][level] === 0) {
    const n = count(40);
    const wave = Math.floor(t / [480, 420, 390, 360][level]);
    const speed = [2.1, 2.4, 2.7, 3.0][level];
    for (let i = 0; i < n; i++) {
      const angle = i * Math.PI * 2 / n + wave * 0.13;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      // 画面の縁で止め、上・横へ放った弾も画面外削除の前に引き戻す。
      const edgeX = Math.abs(dx) < 0.001 ? Infinity : ((dx > 0 ? 372 : 12) - x) / dx;
      const edgeY = Math.abs(dy) < 0.001 ? Infinity : ((dy > 0 ? 432 : 24) - y) / dy;
      const outFrames = Math.max(1, Math.floor(Math.min(310, edgeX, edgeY) / speed));
      const b = game.spawnBullet(x, y, dx * speed, dy * speed, i % 4, 'orb');
      if (b) { b.motion = 'recall'; b.targetX = x; b.targetY = y;
        b.gridRow = outFrames; b.releaseAt = outFrames + [60, 54, 48, 42][level]; b.sway = speed * 1.1; b.gridColumn = i; }
    }
  }
  if (pattern === 'starFlight') emitStarFlight(game);
  if (pattern === 'interview') {
    const threshold = ((game.phase?.duration ?? 60) - 30) * 60;
    if (game.minervaInterviewLateStart < 0 && (game.phaseFrame > threshold || game.phaseHp <= game.phaseMaxHp * 0.4)) {
      game.minervaInterviewLateStart = game.phaseFrame;
      const half = INTERVIEW_PERIOD[level] / 2;
      // 元の発射グリッドを保つ。HPで早めても直前の輪から最低半周期は空く。
      const next = 105 + Math.ceil(t / half) * half;
      game.minervaInterviewNextShot = Math.min(game.minervaInterviewNextShot, next);
    }
    if (game.phaseFrame < game.minervaInterviewNextShot) return;
    const interviewPeriod = INTERVIEW_PERIOD[level] / (game.minervaInterviewLateStart >= 0 ? 2 : 1);
    const wave = game.minervaInterviewWave++;
    game.minervaInterviewNextShot = game.phaseFrame + interviewPeriod;
    // 下側の画面内へ穴を向ける。輪ごとに左右を変え、下端での撃ち続けを通さない。
    const gap = Math.atan2(420 - y, 192 + Math.sin(wave * 1.05 + 0.6) * 135 - x);
    // 数百発を重ねず、描画・更新・当たり判定を輪1本で扱う。
    // 回転の接線速度は通常移動より遅くし、穴を追える余裕を残す。
    game.interviewRings.push({ x, y, radius: 45, speed: INTERVIEW_SPEED[level], gap,
      opening: INTERVIEW_GAP[level], spin: (wave % 2 ? -1 : 1) * INTERVIEW_SPIN[level], color: wave % 4, delay: warning, launched: false, grazed: false });
  }
}
