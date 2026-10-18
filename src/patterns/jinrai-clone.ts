export const CLONE_CHARGE = 90;
export const CLONE_SPLIT = 120;
export const CLONE_FIRST_CHARGE = 105 + 300;

export interface CloneBody { x: number; y: number; opacity: number; }

// 1人で5秒撃つ → 印を結ぶ → 2秒かけて二身へ。残り30秒で三身へ進む。
export function jinraiCloneScene(frame: number, duration = 60) {
  const secondCharge = duration * 60 - 30 * 60;
  const chargeStart = frame < secondCharge ? CLONE_FIRST_CHARGE : secondCharge;
  const from = frame < secondCharge ? 1 : 2;
  const local = frame - chargeStart;
  const charging = local >= 0 && local < CLONE_CHARGE;
  const splitting = local >= CLONE_CHARGE && local < CLONE_CHARGE + CLONE_SPLIT;
  const progress = Math.max(0, Math.min(1, (local - CLONE_CHARGE) / CLONE_SPLIT));
  const eased = progress * progress * (3 - 2 * progress);
  const single = [{ x: 192, y: 124, opacity: 1 }];
  const double = [{ x: 116, y: 142, opacity: 1 }, { x: 268, y: 142, opacity: 1 }];
  const triple = [{ x: 86, y: 142, opacity: 1 }, { x: 192, y: 124, opacity: 1 }, { x: 298, y: 142, opacity: 1 }];
  let bodies = from === 1 ? single : double;
  if (local >= CLONE_CHARGE) {
    const start = from === 1 ? [single[0], { ...single[0], opacity: 0 }] : [double[0], { x: 192, y: 124, opacity: 0 }, double[1]];
    bodies = (from === 1 ? double : triple).map((body, index) => ({
      x: start[index].x + (body.x - start[index].x) * eased,
      y: start[index].y + (body.y - start[index].y) * eased,
      opacity: start[index].opacity + (1 - start[index].opacity) * eased,
    }));
  }
  const shooting = !charging && !splitting;
  const shotStart = local < 0 ? 105 : chargeStart + CLONE_CHARGE + CLONE_SPLIT;
  return { bodies, charging, splitting, chargeProgress: charging ? local / CLONE_CHARGE : 0, shotFrame: shooting ? Math.max(0, frame - shotStart) : -1, chargeStart };
}
