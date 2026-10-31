import type { Game } from '../game';
import { bulletSpeed, FIELD } from '../rules';

export const DASH_CHARGE_START = 90;
export const DASH_CHARGE = 240;
export const DASH_CUTIN = 150;
export const DASH_CHARGED = 330;
export const DASH_ATTACK = 360;
export const DASH_MOVE = 8;
export const DASH_TRAIL_LIFE = 42;
export const ISSEN_CHARGE = 180;
export const ISSEN_WARNING = 60;
export const ISSEN_BREAK = DASH_MOVE + 18;
export const ISSEN_RECOVERY = ISSEN_BREAK + 180;
export const ISSEN_HOP = 60;
export const ISSEN_FADE = 30;
export const ISSEN_END = ISSEN_RECOVERY + ISSEN_HOP * 3;

type Point = [number, number];
export interface Issen {
  origin: Point;
  entry: Point;
  end: Point;
  aim?: Point;
  chargeStart: number;
  attackFrame: number;
  cycle: number;
  hops: Point[];
  trails: { x: number; y: number; frame: number; direction: number }[];
  cancelled: boolean;
}

function randomPoint(upper = false): Point {
  return [40 + Math.random() * (FIELD.w - 80), 54 + Math.random() * (upper ? FIELD.h / 2 - 70 : FIELD.h - 94)];
}

export function createIssen(entry: Point, frame = 0, cycle = 0): Issen {
  const origin = randomPoint(true);
  return { origin, entry, end: [...origin], chargeStart: frame + (cycle ? ISSEN_FADE : DASH_CHARGE_START),
    attackFrame: cycle ? frame + ISSEN_FADE + ISSEN_CHARGE : DASH_ATTACK, cycle, hops: [], trails: [], cancelled: false };
}

function lerp(from: Point, to: Point, progress: number): Point {
  const p = Math.max(0, Math.min(1, progress));
  return [from[0] + (to[0] - from[0]) * p, from[1] + (to[1] - from[1]) * p];
}

// 狙いは発動の1秒前だけ記録する。到達点はその方角の画面端で、自機には追従しない。
function lockAim(game: Game, state: Issen): void {
  state.aim = [game.px, game.py];
  let dx = game.px - state.origin[0], dy = game.py - state.origin[1];
  if (Math.hypot(dx, dy) < 1) { dx = 0; dy = 1; }
  const tx = dx > 0 ? (FIELD.w - 24 - state.origin[0]) / dx : dx < 0 ? (24 - state.origin[0]) / dx : Infinity;
  const ty = dy > 0 ? (FIELD.h - 24 - state.origin[1]) / dy : dy < 0 ? (32 - state.origin[1]) / dy : Infinity;
  const scale = Math.max(1, Math.min(tx, ty));
  state.end = [state.origin[0] + dx * scale, state.origin[1] + dy * scale];
}

export function issenCenter(state: Issen): Point { return lerp(state.origin, state.end, 0.5); }

export function issenScene(game: Game): { position: Point; opacity: number; charging: boolean; progress: number; moving: boolean; direction: number; warning: boolean; elapsed: number; hopping: boolean } | undefined {
  const state = game.jinraiIssen;
  if (!state || game.phase?.pattern !== 'jinraiDash') return undefined;
  const frame = game.phaseFrame, elapsed = frame - state.attackFrame;
  const direction = state.end[0] < state.origin[0] ? -1 : 1;
  const base = { position: state.origin, opacity: 1, charging: frame >= state.chargeStart && elapsed < 0,
    progress: Math.max(0, Math.min(1, (frame - state.chargeStart) / (state.attackFrame - state.chargeStart))),
    moving: elapsed >= 0 && elapsed <= DASH_MOVE, direction,
    warning: !!state.aim && elapsed >= -ISSEN_WARNING && elapsed < 0, elapsed, hopping: false };
  if (frame < state.chargeStart) {
    const p = frame / DASH_CHARGE_START;
    if (!state.cycle) return { ...base, position: lerp(state.entry, state.origin, p * p * (3 - 2 * p)) };
    return { ...base, ...warp(state.entry, state.origin, frame - state.chargeStart + ISSEN_FADE), hopping: true };
  }
  if (elapsed < 0) return base;
  if (elapsed <= DASH_MOVE) return { ...base, position: lerp(state.origin, state.end, elapsed / DASH_MOVE) };
  if (elapsed < ISSEN_RECOVERY) return { ...base, position: state.end };
  const index = Math.min(2, Math.floor((elapsed - ISSEN_RECOVERY) / ISSEN_HOP));
  const local = (elapsed - ISSEN_RECOVERY) % ISSEN_HOP;
  const from = index ? state.hops[index - 1] : state.end;
  const to = state.hops[index] ?? from;
  if (local < ISSEN_FADE && elapsed < ISSEN_END) return { ...base, ...warp(from, to, local), hopping: true };
  return { ...base, position: to };
}

function warp(from: Point, to: Point, local: number): { position: Point; opacity: number; direction: number } {
  const direction = to[0] < from[0] ? -1 : 1;
  const half = ISSEN_FADE / 2;
  if (local < half) return { position: [from[0] + direction * 18 * local / half, from[1]], opacity: 1 - local / half, direction };
  const p = Math.min(1, (local - half) / half);
  return { position: [to[0] - direction * 18 * (1 - p), to[1]], opacity: p, direction };
}

function hitSegment(game: Game, from: Point, to: Point): void {
  if (game.invincible || game.invulnFrames > 0 || game.bombFrames > 0) return;
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const length = dx * dx + dy * dy;
  const p = length ? Math.max(0, Math.min(1, ((game.px - from[0]) * dx + (game.py - from[1]) * dy) / length)) : 0;
  if (Math.hypot(game.px - from[0] - dx * p, game.py - from[1] - dy * p) < 9) {
    game.queueHit(2);
  }
}

function ripple(game: Game, state: Issen, level: number, petal: boolean, extra = false): void {
  const [x, y] = issenCenter(state);
  const n = (petal ? [80, 128, 152, 176] : [48, 72, 96, 120])[level];
  const gap = (petal ? [9, 7, 7, 6] : [7, 5, 5, 4])[level] * Math.PI * 2 / n;
  const safe = Math.atan2((state.aim?.[1] ?? game.py) - y, (state.aim?.[0] ?? game.px) - x);
  const speed = bulletSpeed(game.difficulty, petal ? extra ? 3.2 : 3 : 5.6);
  for (let i = 0; i < n; i++) {
    const angle = i * Math.PI * 2 / n + state.cycle * 0.17 + (extra ? Math.PI / n : 0);
    // 四つの通路は全波で共有する。後続の花びらで出口を塞がない。
    const delta = Math.atan2(Math.sin((angle - safe) * 4), Math.cos((angle - safe) * 4)) / 4;
    if (Math.abs(delta) < gap / 2) continue;
    const b = game.spawnBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, petal ? 0 : 2, petal ? 'petal' : 'needle');
    if (b) { b.radius = petal ? 2.2 : 2.4; b.launchSoundPending = false; if (!petal) b.motion = 'jinraiSpark'; }
  }
  game.audio.play(petal ? 'wind' : 'thunderBurst');
  game.spark(x, y, petal ? '#d6afff' : '#fff4bc', petal ? 12 : 30);
}

export function emitIssen(game: Game, level: number): void {
  let state = game.jinraiIssen;
  if (!state) return;
  const frame = game.phaseFrame;
  let elapsed = frame - state.attackFrame;
  state.trails = state.trails.filter(trail => frame - trail.frame < DASH_TRAIL_LIFE);
  if (elapsed >= ISSEN_END) {
    const entry = state.hops[2] ?? state.end;
    state = createIssen(entry, frame, state.cycle + 1);
    game.jinraiIssen = state;
    game.audio.play('jinraiWarp');
    elapsed = frame - state.attackFrame;
  }
  if (state.cycle && frame === state.chargeStart) game.audio.play('jinraiRecharge');
  if (frame >= state.attackFrame - ISSEN_WARNING && !state.aim) lockAim(game, state);
  if (elapsed === 0) { game.audio.play('slash'); game.audio.play('jinraiWarp'); }
  if (elapsed > 0 && elapsed <= DASH_MOVE) {
    const from = lerp(state.origin, state.end, (elapsed - 1) / DASH_MOVE);
    const to = lerp(state.origin, state.end, elapsed / DASH_MOVE);
    hitSegment(game, from, to);
    const length = Math.hypot(state.end[0] - state.origin[0], state.end[1] - state.origin[1]);
    const previous = Math.floor(length * (elapsed - 1) / DASH_MOVE / 24);
    const next = Math.floor(length * elapsed / DASH_MOVE / 24);
    for (let i = previous; i < next; i++) {
      const [x, y] = lerp(state.origin, state.end, i * 24 / length);
      state.trails.push({ x, y, frame, direction: state.end[0] < state.origin[0] ? -1 : 1 });
    }
  }
  // ボムが余波の途中で入っても、同じ一閃の後続波で弾を戻さない。
  if (game.bombFrames > 0 && elapsed >= 0 && elapsed < ISSEN_RECOVERY) state.cancelled = true;
  if (!state.cancelled && (elapsed === ISSEN_BREAK || elapsed === ISSEN_BREAK + 24 || elapsed === ISSEN_BREAK + 48 && game.phaseHp <= game.phaseMaxHp / 2)) {
    ripple(game, state, level, elapsed !== ISSEN_BREAK, elapsed === ISSEN_BREAK + 48);
  }
  if (elapsed >= ISSEN_RECOVERY && elapsed < ISSEN_END) {
    const index = Math.floor((elapsed - ISSEN_RECOVERY) / ISSEN_HOP), local = (elapsed - ISSEN_RECOVERY) % ISSEN_HOP;
    if (!state.hops[index]) state.hops[index] = randomPoint();
    if (local === 0) game.audio.play('jinraiWarp');
    if (local === 45 && game.bombFrames <= 0) {
      const [x, y] = state.hops[index];
      const aim = Math.atan2(game.py - y, game.px - x), n = [5, 7, 9, 11][level];
      const speed = bulletSpeed(game.difficulty, 4.5);
      // 実体化を見て離れられるよう、発射まで15f空け、近距離のクナイにも短い予告を付ける。
      const delay = Math.hypot(game.px - x, game.py - y) < 80 ? 24 : 0;
      for (let i = 0; i < n; i++) {
        const angle = aim + (i - (n - 1) / 2) * 0.13;
        const b = game.spawnBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 2, 'kunai');
        if (b) { b.radius = 2.4; b.delay = delay; }
      }
      game.triggerBossCast();
    }
  }
}
