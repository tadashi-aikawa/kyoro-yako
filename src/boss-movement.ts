import { FINALE_START } from './patterns/claudine-finale';
import type { Phase } from './stages';

type Point = readonly [number, number];
type Movement = (time: number) => Point;

const CENTER: Point = [192, 0];
const smooth = (t: number): number => t * t * (3 - 2 * t);
export function moveBetween(from: Point, to: Point, progress: number): [number, number] {
  const eased = smooth(Math.max(0, Math.min(1, progress)));
  return [from[0] + (to[0] - from[0]) * eased, from[1] + (to[1] - from[1]) * eased];
}

// 各軌道は中央へ帰って一周する。停止と加減速を含め、繰り返しの境目でも位置を飛ばさない。
function patrol(points: Point[], move: number, hold: number, moveLast = false): Movement {
  const stops = [...points, CENTER];
  return (time) => {
    const segment = Math.floor(time / (move + hold)) % stops.length;
    const from = segment === 0 ? CENTER : stops[segment - 1];
    const local = time % (move + hold);
    return moveBetween(from, stops[segment], (local - (moveLast ? hold : 0)) / move);
  };
}

function curve(width: number, height: number, period: number, shape: 'arc' | 'ellipse' | 'eight'): Movement {
  return (time) => {
    const angle = Math.PI * 2 * (shape === 'arc' ? smooth(time % period / period) : time / period);
    const entrance = smooth(Math.min(1, time / 60));
    const y = shape === 'arc' ? -(Math.sin(angle) ** 2) * height
      : shape === 'ellipse' ? (1 - Math.cos(angle)) * height : Math.sin(angle * 2) * height;
    return [192 + Math.sin(angle) * width * entrance, y * entrance];
  };
}

const MOVEMENTS: Record<string, Movement> = {
  // エトキチはゆっくり止まり、ネオは短い位置替えやショートカットを繰り返す。
  etoile: patrol([[242, -12], [142, -12]], 84, 180),
  galaxyFlash: patrol([[126, -20], [258, 12], [192, -16]], 84, 276, true),
  neoTripleTap: patrol([[126, 0], [252, 20]], 72, 100),
  neoSyncopation: patrol([[112, 18], [192, -8], [272, 18]], 64, 66),
  keyRain: patrol([[112, -14], [272, -14]], 84, 160),
  vim: patrol([[126, -12], [258, 12]], 84, 180),
  dotfiles: curve(82, 24, 660, 'eight'),
  enter: patrol([[112, -24], [272, -24]], 84, 180),
  neoEncore: patrol([[108, -12], [276, -12], [192, 16]], 96, 160),
  // チャッピーは長めに止まる。クロディーヌは整列・格子・対称の軌道を使う。
  codex: patrol([[116, -18], [116, 18], [268, 18], [268, -18]], 84, 180),
  claudinePetalArc: curve(70, 12, 600, 'arc'),
  claudineQuietRings: curve(58, 12, 600, 'ellipse'),
  trim: patrol([[128, -24], [256, -24], [256, 12], [128, 12]], 72, 120),
  type: curve(78, 18, 780, 'arc'),
  grid: patrol([[128, -22], [256, -22], [256, 18], [128, 18]], 72, 132),
  complement: curve(60, 16, 720, 'eight'),
  whiteSpace: curve(34, 8, 840, 'ellipse'),
  // 通常弾幕の高速性とは別に、本体の位置替えには停止と減速を残す。
  jinraiRapidFan: patrol([[108, 0], [276, 12]], 84, 46),
  jinraiRapidRings: curve(100, 18, 420, 'arc'),
  jinraiFan: patrol([[128, -16], [256, 6]], 76, 100),
  jinraiKiss: curve(90, 16, 480, 'arc'),
  // レーザーの寿命260フレームは静止し、次の発射までの40フレームだけ位置を替える。
  jinraiLaser: patrol([[148, -12], [236, -12]], 40, 260, true),
  jinraiThunder: curve(90, 20, 600, 'eight'),
  // 強風で左右へ流す花びらは本体を広く振ると画面外へ早く抜ける。中央寄りの弧で弾量を保つ。
  jinraiSakura: curve(52, 8, 780, 'arc'),
  jinraiPetal: curve(54, 22, 840, 'arc'),
  // ミネルヴァは観測点で一拍置く。回廊の発射間移動と祈りは専用処理に任せる。
  minervaStarFan: patrol([[124, 0], [260, 14]], 96, 136),
  minervaStarRings: curve(80, 16, 660, 'eight'),
  sevenRings: curve(70, 10, 840, 'ellipse'),
  question: patrol([[120, -12], [264, -12]], 96, 120),
  hypothesis: patrol([[136, -16], [248, -16]], 84, 150),
  owlEye: curve(64, 12, 720, 'eight'),
  recall: patrol([[140, -10], [244, -10]], 100, 200, true),
  citation: patrol([[112, -12], [192, 12], [272, -12]], 108, 120),
};

export function enterBossX(time: number): number { return MOVEMENTS.enter(time)[0]; }

function finale(time: number): Point {
  const finaleStart = FINALE_START - 105;
  if (time >= finaleStart) return CENTER;
  const scene = ['trim', 'type', 'grid', 'complement', 'whiteSpace'][Math.floor(time / 600)];
  const local = time % 600;
  const [x, y] = MOVEMENTS[scene](local);
  // 再演の切替と、残り10秒の構えへの移行で中央へ戻す。
  const end = Math.min(600, finaleStart - Math.floor(time / 600) * 600);
  const envelope = smooth(Math.min(1, local / 90, (end - local) / 90));
  return [192 + (x - 192) * envelope, y * envelope];
}

export function hasBossMovement(pattern: string): boolean { return pattern === 'final' || Object.hasOwn(MOVEMENTS, pattern); }

export function patternPosition(phase: Phase, frame: number, entry: Point, encoreCount = 0): [number, number] | undefined {
  if (!hasBossMovement(phase.pattern)) return undefined;
  const baseY = phase.spell ? 132 : 77;
  if (frame < 105 && encoreCount === 0) return moveBetween(entry, [192, baseY], frame / 90);
  // ネオの延長では射撃時計だけが巻き戻る。移動時計は通算し、延長のたびに本体が飛ぶのを防ぐ。
  const time = Math.max(0, frame - 105) + encoreCount * (phase.duration * 60 - 105);
  const [x, y] = phase.pattern === 'final' ? finale(time) : MOVEMENTS[phase.pattern](time);
  return [x, baseY + y];
}
