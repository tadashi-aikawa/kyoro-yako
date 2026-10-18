export const CLONE_CHARGE = 90;
export const CLONE_SPLIT = 120;
export const CLONE_FIRST_CHARGE = 105 + 300;
// 分身は4秒撃つごとに残像を残して跳び、1.5秒撃たずに一息つかせる。跳ぶ順は分身ごとに少しずらす。
export const CLONE_SHOOT = 240;
export const CLONE_HOP = 90;
export const CLONE_STAGGER = 18;
export const HOP_OUT = 6;
export const HOP_IN = 16;
export const HOP_SHOWN = 26;

export interface CloneBody { x: number; y: number; opacity: number; }
export interface CloneTrail { fromX: number; fromY: number; toX: number; toY: number; age: number; }

// 分身ごとの跳び先。先頭は分身直後の立ち位置。
const SPOTS: Record<number, [number, number][][]> = {
  2: [
    [[116, 142], [72, 116], [148, 170], [92, 100]],
    [[268, 142], [312, 116], [236, 170], [292, 100]],
  ],
  3: [
    [[86, 142], [56, 116], [114, 170], [70, 100]],
    [[192, 124], [156, 98], [228, 104], [192, 160]],
    [[298, 142], [328, 116], [270, 170], [314, 100]],
  ],
};

function hop(spots: [number, number][], index: number, elapsed: number): { body: CloneBody; firing: boolean; trail?: CloneTrail } {
  const cycleLength = CLONE_SHOOT + CLONE_HOP;
  const e = elapsed - index * CLONE_STAGGER;
  const cycle = e < 0 ? 0 : Math.floor(e / cycleLength);
  const local = e - cycle * cycleLength;
  const [x, y] = spots[cycle % spots.length];
  if (local < CLONE_SHOOT) return { body: { x, y, opacity: 1 }, firing: true };
  const [toX, toY] = spots[(cycle + 1) % spots.length];
  const age = local - CLONE_SHOOT;
  const trail = age < HOP_SHOWN ? { fromX: x, fromY: y, toX, toY, age } : undefined;
  if (age < HOP_OUT) return { body: { x, y, opacity: 1 - age / HOP_OUT }, firing: false, trail };
  return { body: { x: toX, y: toY, opacity: Math.max(0, Math.min(1, (age - HOP_IN) / (HOP_SHOWN - HOP_IN))) }, firing: false, trail };
}

// 1人で5秒撃つ → 印を結ぶ → 2秒かけて二身へ。残り20秒で三身へ進む。
export function jinraiCloneScene(frame: number, duration = 60) {
  const secondCharge = duration * 60 - 20 * 60;
  const chargeStart = frame < secondCharge ? CLONE_FIRST_CHARGE : secondCharge;
  const from = frame < secondCharge ? 1 : 2;
  const local = frame - chargeStart;
  const charging = local >= 0 && local < CLONE_CHARGE;
  const splitting = local >= CLONE_CHARGE && local < CLONE_CHARGE + CLONE_SPLIT;
  const progress = Math.max(0, Math.min(1, (local - CLONE_CHARGE) / CLONE_SPLIT));
  const eased = progress * progress * (3 - 2 * progress);
  const single = [{ x: 192, y: 124, opacity: 1 }];
  // 三身への溜めは、二身が跳び終えた最後の立ち位置から始める。
  const doubleStart = CLONE_FIRST_CHARGE + CLONE_CHARGE + CLONE_SPLIT;
  const double = SPOTS[2].map((spots, index) => ({ ...hop(spots, index, secondCharge - 1 - doubleStart).body, opacity: 1 }));
  let bodies = from === 1 ? single : double;
  if (local >= CLONE_CHARGE) {
    const start = from === 1 ? [single[0], { ...single[0], opacity: 0 }] : [double[0], { x: 192, y: 124, opacity: 0 }, double[1]];
    bodies = (from === 1 ? SPOTS[2] : SPOTS[3]).map(([[x, y]], index) => ({
      x: start[index].x + (x - start[index].x) * eased,
      y: start[index].y + (y - start[index].y) * eased,
      opacity: start[index].opacity + (1 - start[index].opacity) * eased,
    }));
  }
  const shooting = !charging && !splitting;
  const shotStart = local < 0 ? 105 : chargeStart + CLONE_CHARGE + CLONE_SPLIT;
  let firing = bodies.map(() => shooting);
  let trails: CloneTrail[] = [];
  if (shooting && local >= 0) {
    const states = bodies.map((_, index) => hop(SPOTS[bodies.length][index], index, frame - shotStart));
    bodies = states.map((state) => state.body);
    firing = states.map((state) => state.firing);
    trails = states.flatMap((state) => state.trail ? [state.trail] : []);
  }
  return { bodies, firing, trails, charging, splitting, chargeProgress: charging ? local / CLONE_CHARGE : 0, shotFrame: shooting ? Math.max(0, frame - shotStart) : -1, chargeStart };
}
