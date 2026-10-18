export type BossPose = 'idle' | 'left' | 'right';

export const MOTION_BOSSES = ['etokichi', 'neo', 'obsidia', 'jinrai', 'chappy', 'claudine', 'minerva'] as const;
const MOTION_POSES = ['idle', 'left', 'right'] as const;
// 元絵の白が半透明のボスは、待機で交互に出す片方を描き直した元ポーズにする
const REDRAWN_BASES: readonly string[] = ['neo', 'chappy'];
export const MOTION_SPRITES = MOTION_BOSSES.flatMap((id) => [...MOTION_POSES, ...(REDRAWN_BASES.includes(id) ? ['base'] : [])].map((pose) => `${id}-${pose}`));
export const IDLE_STEP = 22;
const MOVE_ENTER = 0.3;
const MOVE_EXIT = 0.18;
// 迅雷の駆け抜けは16px/フレーム。これを超える飛びは瞬間移動として扱う
const MAX_STEP = 24;

export interface BossMotion { key: string; frame: number; x: number; vx: number; pose: BossPose; }

export function createBossMotion(): BossMotion { return { key: '', frame: -1, x: 0, vx: 0, pose: 'idle' }; }

// 1フレームの移動量は小さく揺れるので、平滑化した速度とヒステリシスで向きを決める。
// 描画は更新と同期しないため、同じフレームの再描画は据え置き、数フレームの飛びは1フレームあたりへ均す
export function updateBossMotion(motion: BossMotion, key: string, frame: number, x: number): BossPose {
  const gap = frame - motion.frame;
  if (motion.key === key && gap === 0) return motion.pose;
  const dx = (x - motion.x) / gap;
  if (motion.key !== key || gap < 0 || gap > 4 || Math.abs(dx) > MAX_STEP) {
    Object.assign(motion, { key, frame, x, vx: 0, pose: 'idle' });
    return motion.pose;
  }
  motion.vx = motion.vx * 0.8 + dx * 0.2;
  motion.frame = frame; motion.x = x;
  const speed = Math.abs(motion.vx);
  if (motion.pose === 'idle' ? speed > MOVE_ENTER : speed > MOVE_EXIT) motion.pose = motion.vx < 0 ? 'left' : 'right';
  else motion.pose = 'idle';
  return motion.pose;
}

export function hasMotionSprites(id: string): boolean { return (MOTION_BOSSES as readonly string[]).includes(id); }

// 待機は元絵と待機絵を交互に出す。移動中は向きの絵を出す
export function bossSpriteId(id: string, pose: BossPose, frame: number): string {
  if (!hasMotionSprites(id)) return id;
  if (pose !== 'idle') return `${id}-${pose}`;
  if (Math.floor(frame / IDLE_STEP) % 2) return `${id}-idle`;
  return REDRAWN_BASES.includes(id) ? `${id}-base` : id;
}
