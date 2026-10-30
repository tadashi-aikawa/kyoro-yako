import type { Bullet, Game } from '../game';

export const FINALE_CHARGE = 120;
export const BLOOM_PERIOD = [156, 132, 114, 96] as const;
export const BLOOM_COUNT = [20, 26, 32, 38] as const;
export const LAYOUT_PERIOD = 600;
export const LAYOUT_WARNING = 72;
export const LAYOUT_MORPH = 150;
export const BLOOM_LIFE = 840;
export const GRAND_PERIOD = 1440;
export const GRAND_QUIET = 480;
export const GRAND_LAUNCH = 600;
export const GRAND_RISE = 96;
export const bloomVariant = (wave: number): 'chrysanthemum' | 'ring' => wave % 6 === 2 ? 'ring' : 'chrysanthemum';
const trails = new WeakMap<Bullet, [number, number][]>();
const shows = new WeakMap<Game, { cycle: number; lastTime: number; grandAt: number; launched: boolean }>();
export const bloomTrail = (b: Bullet): readonly [number, number][] => trails.get(b) ?? [];
export const bloomOpacity = (b: Bullet): number => Math.min(1, b.age / 14, (b.fadeAt - b.age) / Math.max(1, b.swayPhase));
const TAU = Math.PI * 2;
const smooth = (t: number) => { const p = Math.max(0, Math.min(1, t)); return p * p * (3 - 2 * p); };

export interface BloomArena { x: number; y: number; w: number; h: number; }
const FULL: BloomArena = { x: 8, y: 46, w: 368, h: 394 };
const LAYOUTS: readonly BloomArena[] = [
  { x: 10, y: 108, w: 364, h: 304 },
  { x: 72, y: 46, w: 240, h: 394 },
  { x: 34, y: 92, w: 316, h: 316 },
  { x: 72, y: 46, w: 240, h: 394 },
  { x: 10, y: 108, w: 364, h: 304 },
  FULL,
];

export function finaleTime(game: Game): number {
  return game.boss === 'claudine' && game.phase?.pattern === 'final' && !game.phaseIntro ? game.phaseFrame - 105 : -1;
}

export function bloomLayout(t: number): { target: BloomArena; warning: boolean; progress: number } {
  const local = Math.max(0, t - FINALE_CHARGE) % LAYOUT_PERIOD;
  const index = Math.min(LAYOUTS.length - 1, Math.floor(Math.max(0, t - FINALE_CHARGE) / LAYOUT_PERIOD));
  return { target: LAYOUTS[index], warning: t >= FINALE_CHARGE && local < LAYOUT_WARNING, progress: smooth((local - LAYOUT_WARNING) / LAYOUT_MORPH) };
}

export function bloomArena(t: number): BloomArena {
  let from = { x: 0, y: 0, w: 384, h: 448 }, to = FULL, progress = smooth(t / FINALE_CHARGE);
  if (t >= FINALE_CHARGE) {
    const index = Math.min(LAYOUTS.length - 1, Math.floor((t - FINALE_CHARGE) / LAYOUT_PERIOD));
    from = index === 0 ? FULL : LAYOUTS[index - 1]; to = LAYOUTS[index]; progress = bloomLayout(t).progress;
  }
  return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress, w: from.w + (to.w - from.w) * progress, h: from.h + (to.h - from.h) * progress };
}

export function bloomPoint(arena: BloomArena, x: number, y: number): [number, number] {
  return [arena.x + x * arena.w / 384, arena.y + y * arena.h / 448];
}

// 自機・弾・ボスは同じ座標変換を使う。変形だけで弾との位置関係を逆転させない。
export function reflowPlayer(game: Game): void {
  const t = finaleTime(game);
  if (t < 0) return;
  const before = bloomArena(t), after = bloomArena(t + 1);
  game.px = after.x + (game.px - before.x) / before.w * after.w;
  game.py = after.y + (game.py - before.y) / before.h * after.h;
  game.px = Math.max(after.x + 9, Math.min(after.x + after.w - 9, game.px));
  game.py = Math.max(after.y + 12, Math.min(after.y + after.h - 9, game.py));
}

export function bloomBossPosition(frame: number): [number, number] {
  const t = frame - 105;
  const arena = bloomArena(t);
  if (t >= 0 && t < FINALE_CHARGE) {
    // 構えの間は発射しない。枠の上端が動いても、浮上の頂点を指先のポーズへそろえる。
    const first = t < FINALE_CHARGE / 2;
    const from = first ? [192, 132] : [204, 116];
    const to = first ? [204, 116] : bloomPoint(bloomArena(FINALE_CHARGE), 192, 132);
    const p = smooth((first ? t : t - FINALE_CHARGE / 2) / (FINALE_CHARGE / 2));
    return [from[0] + (to[0] - from[0]) * p, from[1] + (to[1] - from[1]) * p];
  }
  return bloomPoint(arena, 192, 132);
}

export function bloomPose(game: Game): { sprite: string; size: number; tilt: number } | undefined {
  if (game.boss !== 'claudine' || game.phase?.pattern !== 'final' || game.phaseIntro) return;
  const t = game.phaseFrame - 105;
  const opening = smooth(t / FINALE_CHARGE);
  const flourish = Math.sin(opening * Math.PI);
  return { sprite: t < 0 ? 'claudine-idle' : t < FINALE_CHARGE / 2 ? 'claudine-cast' : 'claudine-finale', size: 64 + opening * 10 + flourish * 4, tilt: -flourish * 0.12 };
}

export function emitClaudineFinale(game: Game, t: number): void {
  if (t === 0) { game.bullets.clear(); game.audio.play('roseCharge'); }
  if (t < FINALE_CHARGE) return;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const local = t - FINALE_CHARGE;
  const cycle = Math.floor(local / GRAND_PERIOD);
  const step = local % GRAND_PERIOD;
  let show = shows.get(game);
  if (!show || show.cycle !== cycle || t < show.lastTime) {
    show = { cycle, lastTime: t, grandAt: GRAND_LAUNCH, launched: false }; shows.set(game, show);
  }
  show.lastTime = t;
  if (game.bombFrames > 0) {
    if (!show.launched && step >= GRAND_QUIET) show.grandAt = Math.max(show.grandAt, step + 48);
    return;
  }
  const grand = !show.launched && step >= show.grandAt;
  if (!game.phase || game.phase.duration * 60 - game.phaseFrame < (grand ? GRAND_RISE + 54 : 90)) return;
  const resume = show.launched && step > GRAND_LAUNCH + GRAND_RISE && !game.bullets.objects.some((b) => b.active && b.dashWave === 2 && (b.motion === 'bloomSpark' || b.motion === 'bloomRocket'));
  if (!grand && (step >= GRAND_QUIET && !resume || step % BLOOM_PERIOD[level] !== 0)) return;
  const wave = Math.floor(step / BLOOM_PERIOD[level]) + cycle * 6;
  const points = [[92, 140], [286, 166], [192, 104], [120, 195], [260, 130], [192, 178]];
  const [x, y] = grand ? [192, 70] : points[wave % points.length];
  const [bx, by] = bloomPoint(bloomArena(t), x, 420);
  const b = game.spawnBullet(bx, by, 0, 0, 2, 'star');
  if (!b) return;
  if (grand) show.launched = true;
  b.motion = 'bloomRocket'; b.targetX = x; b.targetY = y;
  b.releaseAt = grand ? GRAND_RISE : 54; b.gridColumn = wave; b.radius = 0; b.dashWave = grand ? 2 : 0;
  b.launchSoundPending = false;
  game.triggerBossCast(); game.audio.play(grand ? 'fireworkGrandRise' : 'fireworkRise');
}

function burst(game: Game, source: Bullet): void {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const grand = source.dashWave === 2;
  const count = BLOOM_COUNT[level] + (grand ? 8 + level * 2 : 0), wave = source.gridColumn;
  const variant = grand ? 'willow' : bloomVariant(wave);
  const turn = wave * 0.23;
  for (let layer = 0; layer < 3; layer++) for (let i = 0; i < count; i++) {
    const angle = i * TAU / count + turn + layer * 0.018;
    const speed = grand ? 1.8 + layer * 0.65 + level * 0.06 : (1.05 + layer * 0.4 + level * 0.1) * (variant === 'chrysanthemum' ? 1 + Math.cos(5 * (angle - turn)) * 0.12 : 1);
    const vx = variant === 'ring' ? Math.cos(angle) * speed * 1.15 : Math.cos(angle) * speed;
    const vy = variant === 'ring' ? Math.sin(angle) * speed * 0.38 : grand ? Math.sin(angle) * speed * 0.65 - 0.4 : Math.sin(angle) * speed;
    const color = variant === 'willow' ? layer === 1 ? 3 : 2 : layer === 0 ? 2 : [4, 1, 5, 3, 0, 2][wave % 6];
    const b = game.spawnBullet(source.x, source.y, vx, vy, color, layer === 0 ? 'needle' : 'petal');
    if (!b) continue;
    b.motion = 'bloomSpark'; b.targetX = source.targetX + Math.cos(angle) * (4 + layer * 2); b.targetY = source.targetY + Math.sin(angle) * (4 + layer * 2);
    b.radius = 2.5; b.fadeAt = BLOOM_LIFE; b.delay = 18;
    b.rotation = angle; b.gridRow = layer; b.gridColumn = i; b.dashWave = variant === 'willow' ? 2 : variant === 'ring' ? 1 : 0;
    b.swayRate = 0.006; b.swayPhase = grand ? 150 : 90;
    if (grand) trails.set(b, [[b.targetX, b.targetY]]); else trails.delete(b);
    b.launchSoundPending = false;
  }
  game.audio.play(grand ? 'fireworkBoom' : 'roseBloom'); game.triggerBossCast();
}

// 正規化した弾道を進めてから変形後のエリアへ投影する。途中のブレイクポイントでも跳ねない。
export function updateBloomBullet(game: Game, b: Bullet): 'none' | 'moving' | 'harmless' {
  if (b.motion !== 'bloomSpark' && b.motion !== 'bloomRocket') return 'none';
  const arena = bloomArena(finaleTime(game));
  if (b.motion === 'bloomRocket') {
    const p = Math.min(1, b.age / b.releaseAt);
    [b.x, b.y] = bloomPoint(arena, b.targetX, b.targetY + (420 - b.targetY) * (1 - p) ** 2);
    if (b.age >= b.releaseAt) { burst(game, b); b.active = false; }
    return 'harmless';
  }
  if (b.delay <= 0) {
    const stopY = 424 + (Math.sin(b.gridColumn * 2.4 + b.gridRow * 1.7) * 0.5 + 0.5) * 15;
    if (b.targetY >= 420) {
      b.vx *= 0.98;
      b.vy = Math.max(0, Math.min(b.vy * (b.dashWave === 2 ? 0.96 : 0.95), (stopY - b.targetY) * 0.07));
    } else if (b.dashWave === 2) {
      if (b.age < 108) { b.vx *= 0.982; b.vy = b.vy * 0.982 + 0.007; }
      else { b.vx *= 0.99; b.vy = Math.min(1, b.vy + 0.006); }
    } else { b.vx *= 0.997; b.vy = b.vy * 0.997 + b.swayRate; }
    b.targetX += b.vx; b.targetY = Math.min(stopY, b.targetY + b.vy);
    b.rotation = Math.atan2(b.vy, b.vx);
  }
  if (b.dashWave === 2 && b.age % 5 === 0) {
    const trail = trails.get(b)!; trail.push([b.targetX, b.targetY]);
    if (trail.length > 25) trail.shift();
  }
  // 下端へ届く前に寿命で無害化しない。フェードは下端への到達を起点にする。
  if (b.targetY >= 420 && b.fadeAt === BLOOM_LIFE) b.fadeAt = Math.min(BLOOM_LIFE, b.age + b.swayPhase);
  [b.x, b.y] = bloomPoint(arena, b.targetX, b.targetY);
  const margin = b.dashWave === 2 ? 192 : 24;
  if (b.targetX < -margin || b.targetX > 384 + margin || b.targetY < (b.dashWave === 2 ? -60 : -32) || b.targetY > 600) b.active = false;
  return b.age >= b.fadeAt - Math.max(18, Math.ceil(b.swayPhase * 0.35)) ? 'harmless' : 'moving';
}
