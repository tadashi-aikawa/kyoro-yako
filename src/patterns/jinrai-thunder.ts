import type { Game } from '../game';
import { FIELD } from '../rules';

type Point = [number, number];
export interface Thunderbolt { age: number; speed: number; width: number; points: Point[]; }
export interface Thunderstorm { cycle: number; lanes: number[]; }
export const THUNDER_PERIOD = [270, 240, 216, 198] as const;
export const THUNDER_CALL = 84;
export const THUNDER_STAGGER = [18, 16, 14, 12] as const;
export const THUNDER_TIP = 10;
export const THUNDER_HOLD = 14;
export const THUNDER_FADE = 12;

export function thunderPosition(frame: number, difficulty: Game['difficulty']): Point {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const t = Math.max(0, frame - 105), period = THUNDER_PERIOD[level];
  const cycle = Math.floor(t / period), step = t % period;
  const stops: Point[] = [[192, 132], [132, 116], [252, 148]];
  const from = stops[cycle % 3], to = stops[(cycle + 1) % 3];
  const p = Math.max(0, (step - (period - 48)) / 48), eased = p * p * (3 - 2 * p);
  return [from[0] + (to[0] - from[0]) * eased, from[1] + (to[1] - from[1]) * eased];
}

export function thunderHead(bolt: Thunderbolt): number {
  return Math.min(FIELD.h + 12, bolt.age <= THUNDER_TIP ? bolt.age * 1.2 : 12 + (bolt.age - THUNDER_TIP) * bolt.speed);
}
export function thunderGround(bolt: Thunderbolt): number { return THUNDER_TIP + Math.ceil(FIELD.h / bolt.speed); }
export function thunderHot(bolt: Thunderbolt): boolean { return bolt.age > THUNDER_TIP && bolt.age < thunderGround(bolt) + THUNDER_HOLD; }

// 先端より下は描かず、判定にも使わない。隠れた経路の全体表示を位置予告にしない。
export function thunderPath(bolt: Thunderbolt): Point[] {
  const head = thunderHead(bolt);
  const path: Point[] = [bolt.points[0]];
  for (let i = 1; i < bolt.points.length; i++) {
    const next = bolt.points[i], previous = bolt.points[i - 1];
    if (next[1] <= head) path.push(next);
    else { const p = (head - previous[1]) / (next[1] - previous[1]); path.push([previous[0] + (next[0] - previous[0]) * p, head]); break; }
  }
  return path;
}

export function thunderHits(bolt: Thunderbolt, x: number, y: number): boolean {
  if (!thunderHot(bolt)) return false;
  const path = thunderPath(bolt);
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i];
    const dx = bx - ax, dy = by - ay;
    const p = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    if (Math.hypot(x - ax - dx * p, y - ay - dy * p) < bolt.width / 2 + 2.5) return true;
  }
  return false;
}

export function thunderScene(game: Game): { step: number; charging: boolean; flash: number; darkness: number } | undefined {
  if (game.phase?.pattern !== 'jinraiThunder' || !game.jinraiThunderstorm) return undefined;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const step = game.phaseFrame - 105 - game.jinraiThunderstorm.cycle * THUNDER_PERIOD[level];
  const pulse = Math.max(0, ...[18, 36].map((at) => step >= at && step < at + 6 ? 1 - (step - at) / 6 : 0));
  // 閃光の瞬間だけ暗転を解き、自機と迅雷の位置を見せる。
  const darkness = Math.min(0.94, step / 24 * 0.94) * (1 - pulse) * Math.max(0, 1 - Math.max(0, step - THUNDER_CALL) / 36);
  return { step, charging: step < THUNDER_CALL, flash: pulse * 0.28, darkness };
}

export function emitThunder(game: Game, t: number): void {
  if (game.bombFrames > 0) return;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const step = t % THUNDER_PERIOD[level], cycle = Math.floor(t / THUNDER_PERIOD[level]);
  if (step === 0) {
    game.jinraiThunderstorm = { cycle, lanes: [] };
    game.audio.play('prayerCharge');
  }
  const storm = game.jinraiThunderstorm;
  // ボムで詠唱を消した後、同じ周期の後続落雷を復活させない。
  if (!storm || storm.cycle !== cycle) return;
  if (step === 36) game.audio.play('ninpo');
  const shot = (step - THUNDER_CALL) / THUNDER_STAGGER[level];
  if (!Number.isInteger(shot) || shot < 0 || shot >= [2, 3, 4, 5][level]) return;
  if (shot === 0) {
    const shift = (Math.random() - 0.5) * 40;
    const first = Math.max(20, Math.min(FIELD.w - 20, game.px + (Math.random() - 0.5) * 24));
    const candidates = Array.from({ length: 8 }, (_, i) => 24 + i * 48 + shift);
    // 自機の近くの1本と、毎周期違う場所の雷を時差で落とす。全座標は発生まで画面へ出さない。
    const rest = candidates.filter((x) => x >= 12 && x <= FIELD.w - 12 && Math.abs(x - first) > 14);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    storm.lanes = [first, ...rest];
  }
  // 一度避けた先を周期全体の安全帯にしない。奇数番の追撃は、その発生時の自機付近を取り直す。
  const target = shot % 2 ? Math.max(20, Math.min(FIELD.w - 20, game.px + (Math.random() - 0.5) * 56)) : storm.lanes[shot];
  const x = target + (Math.random() - 0.5) * 16;
  const points: Point[] = [[x, -12]];
  for (let y = 20; y < FIELD.h + 12; y += 28) points.push([Math.max(12, Math.min(FIELD.w - 12, x + (Math.random() - 0.5) * 20)), y]);
  points.push([x, FIELD.h + 12]);
  game.jinraiBolts.push({ age: 0, speed: [10, 13, 16, 19][level], width: [6, 7, 8, 9][level], points });
  game.triggerBossCast(); game.audio.play('thunder');
}

export function updateThunder(game: Game): void {
  for (let i = game.jinraiBolts.length - 1; i >= 0; i--) {
    const bolt = game.jinraiBolts[i]; bolt.age++;
    if (bolt.age >= thunderGround(bolt) + THUNDER_HOLD + THUNDER_FADE) { game.jinraiBolts.splice(i, 1); continue; }
    if (game.invulnFrames <= 0 && !game.invincible && game.pendingHit < 0 && thunderHits(bolt, game.px, game.py)) { game.pendingHit = 0; game.hitDuringSpell = true; }
  }
}
