import type { Game } from '../game';
import { FIELD } from '../rules';

export const COURSE_SPEED = [2, 2.2, 2.4, 2.6] as const;
export const COURSE_WIDTH = [104, 92, 82, 72] as const;
export const COURSE_LAP = 1440;
const START_Y = -12;
const CORNERS = [[0, 192], [140, 192], [300, 270], [480, 108], [530, 108], [710, 276], [760, 276], [940, 108], [1140, 252], [1320, 192], [COURSE_LAP, 192]] as const;

// 過去のコースが下へ流れ、上側に次のカーブが見える。
export function courseCenter(t: number): number {
  if (t < 0) return 192;
  const local = t % COURSE_LAP;
  for (let i = 1; i < CORNERS.length; i++) {
    const [end, x] = CORNERS[i];
    if (local > end) continue;
    const [start, from] = CORNERS[i - 1];
    const p = (local - start) / (end - start);
    return from + (x - from) * p * p * (3 - 2 * p);
  }
  return 192;
}

export function courseCenterAt(t: number, y: number, level: number): number {
  return courseCenter(t - (y - START_Y) / COURSE_SPEED[level]);
}

export function courseFront(t: number, level: number): number {
  return Math.min(FIELD.h, START_Y + t * COURSE_SPEED[level]);
}

export function courseContact(t: number, x: number, y: number, level: number): boolean {
  if (t < 0 || y - 2.5 > courseFront(t, level)) return false;
  const center = courseCenterAt(t, y, level);
  const slope = (courseCenterAt(t, y + 1, level) - courseCenterAt(t, y - 1, level)) / 2;
  return Math.abs(x - center) + 2.5 * Math.sqrt(1 + slope * slope) >= COURSE_WIDTH[level] / 2;
}

export function updateCourse(game: Game, t: number): void {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  if (t % 180 === 0) game.triggerBossCast();
  if (t === 0) game.audio.play('turn');
  if (courseContact(t, game.px, game.py, level)) game.queueHit();
}

export function drawCourse(c: CanvasRenderingContext2D, game: Game): void {
  if (game.phase?.pattern !== 'trim') return;
  const t = game.phaseFrame - 105;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const front = courseFront(t, level);
  if (front <= 0) return;
  const halfWidth = COURSE_WIDTH[level] / 2;
  c.save();
  c.fillStyle = '#151426'; c.globalAlpha = 0.96;
  c.fillRect(0, 0, FIELD.w, front);
  // 左右の壁は2枚のパスで描く。弾オブジェクトも文字スプライトも生成しない。
  c.beginPath();
  for (const side of [-1, 1]) {
    const edge = side < 0 ? 0 : FIELD.w;
    c.moveTo(edge, 0);
    for (let y = 0; y < front; y += 6) c.lineTo(courseCenterAt(t, y, level) + side * halfWidth, y);
    c.lineTo(courseCenterAt(t, front, level) + side * halfWidth, front);
    c.lineTo(edge, front); c.closePath();
  }
  c.fillStyle = '#643747'; c.fill();
  c.save(); c.clip();
  c.strokeStyle = '#a36967'; c.lineWidth = 1; c.globalAlpha = 0.4;
  const scroll = t * COURSE_SPEED[level] % 32;
  c.beginPath();
  for (let y = scroll - FIELD.w; y < front; y += 32) {
    c.moveTo(0, y); c.lineTo(FIELD.w, y + FIELD.w);
  }
  c.stroke(); c.restore();
  c.globalAlpha = 1; c.strokeStyle = '#f2d09b'; c.lineWidth = 2;
  c.beginPath();
  for (const side of [-1, 1]) {
    c.moveTo(courseCenterAt(t, 0, level) + side * halfWidth, 0);
    for (let y = 6; y < front; y += 6) c.lineTo(courseCenterAt(t, y, level) + side * halfWidth, y);
    c.lineTo(courseCenterAt(t, front, level) + side * halfWidth, front);
  }
  c.stroke();
  c.restore();
}
