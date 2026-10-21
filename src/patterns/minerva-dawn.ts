import type { Game } from '../game';

export const PRAYER_PERIOD = 360;
export const PRAYER_CHARGE = 72;
export const PRAYER_FIRE = 180;
export const CONSTELLATION_TIME = 480;
export const DAWN_CYCLE = CONSTELLATION_TIME + PRAYER_PERIOD;
export interface DawnStar {
  x: number; y: number; lockAt: number; fireAt: number; angle?: number; fired: boolean; tier: number; color: number;
}
export function dawnPrayerStep(frame: number): number {
  if (frame < 105) return -1;
  const local = (frame - 105) % DAWN_CYCLE;
  return local < CONSTELLATION_TIME ? -1 : local - CONSTELLATION_TIME;
}
export function dawnPosition(frame: number): [number, number] {
  const usual: [number, number] = [192 + Math.sin(frame * 0.012) * 42, 132 + Math.sin(frame * 0.018) * 4];
  const step = dawnPrayerStep(frame);
  if (step < 0) return usual;
  const start = frame - step;
  const fixed: [number, number] = [192 + Math.sin(start * 0.012) * 42, 132 + Math.sin(start * 0.018) * 4];
  if (step < PRAYER_CHARGE + PRAYER_FIRE) return fixed;
  const progress = (step - PRAYER_CHARGE - PRAYER_FIRE) / (PRAYER_PERIOD - PRAYER_CHARGE - PRAYER_FIRE);
  const ease = progress * progress * (3 - 2 * progress);
  return [fixed[0] + (usual[0] - fixed[0]) * ease, fixed[1] + (usual[1] - fixed[1]) * ease];
}
export function dawnTier(ratio: number): number { return ratio <= 1 / 3 ? 2 : ratio <= 2 / 3 ? 1 : 0; }

export function emitDawn(game: Game): void {
  const t = game.phaseFrame - 105, cycle = Math.floor(t / DAWN_CYCLE), local = t % DAWN_CYCLE;
  const prayer = dawnPrayerStep(game.phaseFrame);
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  if (game.minervaDawnCycle !== cycle) {
    game.minervaDawnCycle = cycle; game.dawnStars.length = 0;
  }
  if (prayer >= 0) game.dawnStars.length = 0;
  if (game.bombFrames > 0) return;
  if (prayer < 0) {
    const warning = [100, 84, 70, 60][level], spacing = [36, 30, 26, 22][level];
    // ボム明けは残り時間に収まる新しい予告だけを出す。
    if (!game.dawnStars.length && local + warning + 30 < CONSTELLATION_TIME) {
      const tier = dawnTier(game.phaseHp / game.phaseMaxHp);
      const points = [[44, 158], [88, 138], [136, 118], [192, 102], [248, 118], [296, 138], [340, 158]];
      const order = (tier === 0 ? [0, 6, 1, 5, 2, 4, 3] : tier === 1 ? [0, 1, 2, 3, 4, 5, 6] : [3, 2, 4, 1, 5, 0, 6]);
      if (cycle % 2) order.reverse();
      const rotation = (cycle % 2 ? -1 : 1) * tier * 0.12;
      for (const [index, [px, py]] of points.entries()) {
        const rank = order.indexOf(index), lockAt = game.phaseFrame + rank * spacing;
        if (local + rank * spacing + warning + 30 >= CONSTELLATION_TIME) continue;
        const dx = (px - 192) * (1 - tier * 0.12), dy = (py - 130) * (1 + tier * 0.12);
        game.dawnStars.push({ x: 192 + dx * Math.cos(rotation) - dy * Math.sin(rotation),
          y: 130 + dx * Math.sin(rotation) + dy * Math.cos(rotation), lockAt, fireAt: lockAt + warning, fired: false, tier, color: index % 2 ? 1 : 2 });
      }
    }
    for (const star of game.dawnStars) {
      if (star.angle === undefined && game.phaseFrame >= star.lockAt) {
        star.angle = Math.atan2(game.py - star.y, game.px - star.x);
      }
      if (star.fired || star.angle === undefined || game.phaseFrame < star.fireAt) continue;
      star.fired = true; game.triggerBossCast(); game.audio.play('wind');
      const count = [5, 7, 9, 11][level] + star.tier * 2;
      for (let i = 0; i < count; i++) {
        const angle = star.angle + (i - (count - 1) / 2) * [0.16, 0.14, 0.12, 0.11][level];
        const speed = [1.6, 1.85, 2.15, 2.45][level] + star.tier * 0.1;
        const b = game.spawnBullet(star.x, star.y, Math.cos(angle) * speed, Math.sin(angle) * speed, star.color, 'petal');
        if (b) b.radius = 2.8;
      }
    }
    return;
  }
  if (prayer === 0) game.audio.play('prayerCharge');
  const fireTime = prayer - PRAYER_CHARGE;
  if (fireTime < 0 || fireTime >= PRAYER_FIRE || fireTime % [4, 3, 2, 2][level] !== 0) return;
  if (fireTime === 0) game.audio.play('laser');
  if (fireTime % 12 === 0) game.audio.play('split');
  const [x, y] = game.bossPosition(), arms = [5, 7, 9, 11][level];
  const rotation = (cycle % 2 ? -1 : 1) * fireTime * 0.027;
  for (let i = 0; i < arms; i++) {
    const angle = Math.PI / 2 + rotation + i * Math.PI * 2 / arms, speed = [2.6, 3.0, 3.6, 4.2][level];
    const b = game.spawnBullet(x + Math.cos(angle) * 22, y + Math.sin(angle) * 22, Math.cos(angle) * speed, Math.sin(angle) * speed, i % 2 ? 1 : 2, 'orb');
    if (b) b.radius = 2.3;
  }
}
