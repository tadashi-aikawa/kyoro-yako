type Point = readonly [number, number];
interface Stop { at: Point; move: number; hold: number; }

// 書庫では上部に留まり、移動先で減速・停止する。弾避けに使う下半分へは踏み込まない。
const SHELVES: Stop[] = [
  { at: [100, 77], move: 72, hold: 84 },
  { at: [100, 112], move: 48, hold: 60 },
  { at: [284, 112], move: 108, hold: 96 },
  { at: [284, 77], move: 48, hold: 60 },
  { at: [192, 77], move: 72, hold: 84 },
];
const BOOKSHELF: Stop[] = [
  { at: [112, 108], move: 64, hold: 116 },
  { at: [272, 108], move: 96, hold: 144 },
  { at: [192, 148], move: 72, hold: 108 },
  { at: [192, 132], move: 40, hold: 80 },
];
const TAGS: Stop[] = [
  { at: [116, 112], move: 72, hold: 108 },
  { at: [268, 112], move: 96, hold: 108 },
  { at: [192, 150], move: 72, hold: 132 },
  { at: [192, 132], move: 48, hold: 84 },
];
const ease = (t: number): number => t * t * (3 - 2 * t);
const between = (from: Point, to: Point, t: number): [number, number] => [
  from[0] + (to[0] - from[0]) * ease(t), from[1] + (to[1] - from[1]) * ease(t),
];

function patrol(t: number, origin: Point, stops: Stop[]): [number, number] {
  const period = stops.reduce((sum, stop) => sum + stop.move + stop.hold, 0);
  let step = t % period;
  let from = origin;
  for (const stop of stops) {
    if (step < stop.move + stop.hold) return between(from, stop.at, Math.min(1, step / stop.move));
    step -= stop.move + stop.hold;
    from = stop.at;
  }
  return [...origin];
}

export function obsidiaPosition(pattern: string, frame: number, entry: Point): [number, number] {
  const origin: Point = [192, pattern.startsWith('obsidia') ? 77 : 132];
  // 宣言中に前の技の終了位置から戻す。射撃開始後は毎回同じ軌道になり、位置を覚えて攻略できる。
  if (frame < 105) return between(entry, origin, Math.min(1, frame / 90));
  const t = frame - 105;
  if (pattern === 'bookshelf') return patrol(t, origin, BOOKSHELF);
  if (pattern === 'obsidiaShelves') return patrol(t, origin, SHELVES);
  if (pattern === 'tags') return patrol(t, origin, TAGS);
  if (pattern === 'clean') {
    // 中央→左→右→中央の弧。折り返しで速度を落とし、同じ高さの往復から変化を付ける。
    const angle = Math.PI * 2 * ease((t % 600) / 600);
    return [192 - Math.sin(angle) * 94, 132 - Math.sin(angle) ** 2 * 34];
  }
  // 索引は小さな8の字、リンクは横長の8の字。開始直後の速度だけを抑える。
  const index = pattern === 'obsidiaIndex';
  const angle = t * Math.PI * 2 / (index ? 420 : 540);
  const entrance = ease(Math.min(1, t / 60));
  return [192 + Math.sin(angle) * (index ? 72 : 96) * entrance,
    origin[1] + Math.sin(angle * 2) * (index ? 16 : 25) * entrance];
}
