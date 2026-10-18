import type { Bullet, Game, Shot } from '../game';

export const ENTER_REFLECT_COOLDOWN = [30, 22, 16, 12] as const;

export function reflectEnterShot(game: Game, shot: Shot, fromX: number, fromY: number, letters: readonly Bullet[]): boolean {
  if (game.phase?.pattern !== 'enter' || game.bombFrames > 0) return false;
  const dx = shot.x - fromX, dy = shot.y - fromY, length2 = dx * dx + dy * dy;
  let target: Bullet | undefined, first = Infinity;
  for (const b of letters) {
    if (!b.active || b.motion !== 'enterLine' || b.delay > 0) continue;
    const cx = fromX - b.x, cy = fromY - b.y, radius = Math.max(6.5, b.radius) + shot.radius;
    const dot = cx * dx + cy * dy, distance2 = cx * cx + cy * cy - radius * radius;
    let entry = 0;
    if (distance2 > 0) {
      const discriminant = dot * dot - length2 * distance2;
      if (!length2 || discriminant < 0) continue;
      entry = (-dot - Math.sqrt(discriminant)) / length2;
      if (entry < 0 || entry > 1) continue;
    }
    if (entry < first) { first = entry; target = b; }
  }
  if (!target) return false;
  shot.active = false;
  // enterLineでは未使用のreleaseAtを次の反射が可能になるageとして使う。
  // 同時に当たるショットも必ず止め、Easyほど返す弾を減らす。
  if (target.age < target.releaseAt) return true;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  target.releaseAt = target.age + ENTER_REFLECT_COOLDOWN[level];
  const contactX = fromX + dx * first;
  const side = Math.abs(contactX - target.x) > 0.75 ? Math.sign(contactX - target.x)
    : Math.abs(shot.vx) > 0.1 ? Math.sign(shot.vx) : target.gridColumn % 2 ? 1 : -1;
  const component = [1.55, 1.75, 1.95, 2.15][level] / Math.SQRT2;
  const reflected = game.spawnBullet(target.x, target.y, side * component, component, 1, 'needle');
  if (reflected) { reflected.radius = 3; reflected.rotation = Math.atan2(reflected.vy, reflected.vx) - Math.PI / 2; reflected.fadeAt = 210; reflected.launchSoundPending = false; }
  game.spark(target.x, target.y, '#a9f7ff', 2);
  return true;
}
