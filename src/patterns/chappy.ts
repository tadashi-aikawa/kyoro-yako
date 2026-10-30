import type { Bullet, Game } from '../game';
import { FIELD } from '../rules';

export const YOYO_WARNING = [66, 54, 48, 42] as const;
export const YOYO_FLIGHT = [210, 186, 168, 150] as const;
export const YOYO_REST = 30;
export const YOYO_BEADS = 3;
export const YOYO_STAGGER = 8;
export const YOYO_BOTTOM = FIELD.h - 3;
export const YOYO_STATIONS = [[192, 132], [136, 116], [248, 140], [160, 120], [224, 144]] as const;
export const YOYO_MOVE = 90;
export const CAROM_BURST = [2, 3, 4, 5] as const;
export const CAROM_CAP = [10, 15, 20, 25] as const;
export const CAROM_PERIOD = [240, 210, 180, 150] as const;
export const CAROM_SPEED = [1.5, 1.8, 2.1, 2.4] as const;
export const CAROM_WARNING = 42;
export const SUGAR_PERIOD = [300, 276, 252, 228] as const;
export const SUGAR_WARNING = [114, 102, 90, 84] as const;
export const SUGAR_CUE = 54;

export function chappyLevel(game: Game): number { return ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty); }
export function yoyoPeriod(level: number): number { return YOYO_WARNING[level] + YOYO_FLIGHT[level] + YOYO_STAGGER * (YOYO_BEADS - 1) + YOYO_REST; }

export function yoyoPosition(time: number, level: number): [number, number] {
  const period = yoyoPeriod(level), wave = Math.floor(time / period), local = time % period;
  const from = YOYO_STATIONS[wave % YOYO_STATIONS.length], to = YOYO_STATIONS[(wave + 1) % YOYO_STATIONS.length];
  const progress = Math.max(0, Math.min(1, (local - YOYO_WARNING[level] - YOYO_STAGGER * (YOYO_BEADS - 1) - 12) / YOYO_MOVE));
  const ease = progress * progress * (3 - 2 * progress);
  return [from[0] + (to[0] - from[0]) * ease, from[1] + (to[1] - from[1]) * ease];
}

// 往復とも画面内で完結する。復路を別の弧にして、同じ場所を待つだけの往復にしない。
export function yoyoPoint(b: Bullet, progress: number): [number, number] {
  const angle = Math.PI * Math.max(0, Math.min(1, progress));
  // 往路は発射点から。復路の終盤だけ移動先へ寄せ、動いた本体の手元で回収する。
  const returning = Math.max(0, Math.min(1, (progress - 0.72) / 0.28));
  const ease = returning * returning * (3 - 2 * returning);
  const x = b.targetX + (b.sway - b.targetX) * Math.sin(angle) + b.swayRate * Math.sin(angle * 2);
  const y = b.targetY + (b.swayPhase - b.targetY) * Math.sin(angle);
  return [x + (b.rotation - b.targetX) * ease, y + (b.spin - b.targetY) * ease];
}

export function yoyoStep(b: Bullet): number { return (b.age - 1) % yoyoPeriod(b.dashWave) - b.gridRow * YOYO_STAGGER; }

export function hasSugarWave(game: Game): boolean { return game.bullets.objects.some((b) => b.active && b.motion === 'chappySugar'); }

export function sugarCasting(game: Game): boolean {
  if (game.phase?.pattern !== 'chappySugar' || game.phaseFrame < 105 || game.bombFrames > 0 || !hasSugarWave(game)) return false;
  const level = chappyLevel(game), step = (game.phaseFrame - 105) % SUGAR_PERIOD[level];
  return step >= SUGAR_WARNING[level] - 28 && step < SUGAR_WARNING[level] + 18;
}

export function emitChappy(game: Game, pattern: string, t: number): void {
  if (game.bombFrames > 0) return;
  const level = chappyLevel(game);
  const [x, y] = game.bossPosition();
  if (pattern === 'chappyYoyo' && t % yoyoPeriod(level) === 0 && !game.bullets.objects.some((b) => b.active && b.motion === 'chappyYoyo')) {
    const lanes = [7, 9, 11, 13][level];
    for (let lane = 0; lane < lanes; lane++) for (let bead = 0; bead < YOYO_BEADS; bead++) {
      const b = game.spawnBullet(x, y, 0, 0, lane % 2 ? 3 : 1);
      if (!b) continue;
      b.motion = 'chappyYoyo'; b.radius = bead === 0 ? 5 : 3;
      b.gridColumn = lane; b.gridRow = bead; b.dashWave = level; b.dashOrder = lanes;
      b.targetX = x; b.targetY = y; b.launchSoundPending = false;
    }
  }
  if (pattern === 'chappyStitch') {
    // 既存の技IDを維持し、交互切替から少数のビリヤード弾へ置き換える。
    const balls = game.bullets.objects.filter((b) => b.active && b.motion === 'chappyStitch');
    const latest = balls.reduce((last, b) => Math.max(last, b.releaseAt), -Infinity);
    if (balls.length >= CAROM_CAP[level] || t - latest < CAROM_PERIOD[level]) return;
    const wave = balls.reduce((last, b) => Math.max(last, b.dashWave), -1) + 1;
    const count = Math.min(CAROM_BURST[level], CAROM_CAP[level] - balls.length);
    for (let index = 0; index < count; index++) {
      let angle = Math.PI * (0.2 + index * 0.6 / Math.max(1, count - 1) + Math.sin(wave * 1.7) * 0.045);
      // 縦だけの往復を避け、中央の球も側壁まで転がす。
      if (Math.abs(Math.cos(angle)) < 0.3) angle = Math.PI * (wave % 2 ? 0.62 : 0.38);
      const speed = CAROM_SPEED[level] * (0.94 + index % 3 * 0.06);
      const b = game.spawnBullet(x + Math.cos(angle) * 22, y + Math.sin(angle) * 22, Math.cos(angle) * speed, Math.sin(angle) * speed, index % 2 ? 3 : 1);
      if (!b) continue;
      b.motion = 'chappyStitch'; b.radius = 7; b.releaseAt = t; b.delay = 1;
      b.gridColumn = index; b.gridRow = balls.length + index; b.dashWave = wave; b.swayPhase = 0; b.launchSoundPending = false;
    }
    game.triggerBossCast();
  }
  if (pattern === 'chappySugar' && t % SUGAR_PERIOD[level] === 0) {
    const wave = Math.floor(t / SUGAR_PERIOD[level]), columns = [7, 8, 9, 10][level], rows = [3, 4, 5, 5][level];
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const sx = 32 + col * (FIELD.w - 64) / (columns - 1);
      const sy = 96 + row * 40 + Math.sin(col * 0.8 + wave) * 8;
      const b = game.spawnBullet(sx, sy, 0, 0.16, (row + col) % 2 ? 3 : 1);
      if (!b) continue;
      // 方向は配置時に固定する。予告後の自機追尾や、加速時の照準の取り直しはしない。
      const angle = Math.PI / 2 + ((row + wave) % 2 ? -1 : 1) * (0.36 + Math.sin(wave * 0.8) * 0.12);
      const speed = [2.0, 2.5, 2.9, 3.3][level];
      b.motion = 'chappySugar'; b.radius = 3.2; b.releaseAt = SUGAR_WARNING[level];
      b.targetX = Math.cos(angle) * speed; b.targetY = Math.sin(angle) * speed;
      b.swayPhase = col * 0.8 + row; b.gridColumn = col; b.gridRow = row;
      b.delay = 1; b.launchSoundPending = false;
    }
  }
}

// 専用移動の弾も、実体がある間はゲーム共通の接触・グレイズ判定を使う。
// harmlessは移動済み・判定なし、movingは移動済み・共通判定ありを示す。
export function updateChappyBullet(game: Game, b: Bullet): 'harmless' | 'moving' | undefined {
  const level = chappyLevel(game);
  if (b.motion === 'chappyYoyo') {
    const period = yoyoPeriod(level), local = (b.age - 1) % period, wave = Math.floor((game.phaseFrame - 105) / period);
    if (local === 0) {
      const [x, y] = game.bossPosition(); b.targetX = x; b.targetY = y;
      // rotation/spinは専用描画では使わないため、ヨーヨーの帰還先X/Yとして保持する。
      [b.rotation, b.spin] = YOYO_STATIONS[(wave + 1) % YOYO_STATIONS.length];
      const end = 28 + b.gridColumn * (FIELD.w - 56) / (b.dashOrder - 1);
      b.sway = Math.max(22, Math.min(FIELD.w - 22, end + Math.sin(wave * 1.6) * 18));
      b.swayPhase = YOYO_BOTTOM;
      b.swayRate = (b.gridColumn % 2 ? -1 : 1) * 26;
      // 両端の二本ずつは手元へ短く回す。自機位置に依存させず、本体脇の帯を毎周通す。
      if (b.gridColumn < 2 || b.gridColumn >= b.dashOrder - 2) {
        const side = b.gridColumn < 2 ? -1 : 1;
        const depth = b.gridColumn === 0 || b.gridColumn === b.dashOrder - 1 ? 0 : 2;
        b.sway = x + side * 44; b.swayPhase = [148, 172, 204, 236][(wave + depth) % 4]; b.swayRate = side * 36;
      }
      b.grazed = false;
    }
    const step = yoyoStep(b), warning = YOYO_WARNING[level], flight = YOYO_FLIGHT[level];
    const [nx, ny] = yoyoPoint(b, (step - warning) / flight);
    b.vx = nx - b.x; b.vy = ny - b.y; b.x = nx; b.y = ny;
    const leader = b.gridColumn === 0 && b.gridRow === 0;
    if (leader && step === warning) { game.audio.play('enemyShot'); game.triggerBossCast(); }
    if (leader && step === warning + Math.floor(flight / 2)) game.audio.play('turn');
    if (leader && local === period - YOYO_REST) game.spark(b.x, b.y, '#c1f4eb', 8);
    return step <= warning || step >= warning + flight ? 'harmless' : 'moving';
  }
  if (b.motion === 'chappyStitch') {
    if (b.age < CAROM_WARNING) return 'harmless';
    if (b.age === CAROM_WARNING) {
      b.delay = 0;
      if (b.gridColumn === 0) game.audio.play('enemyShot');
    }
    b.x += b.vx; b.y += b.vy; b.swayPhase = Math.max(0, b.swayPhase - 1);
    const left = b.radius + 3, right = FIELD.w - b.radius - 3;
    const top = b.radius + 3, bottom = FIELD.h - b.radius - 3;
    let bounced = false;
    if (b.x < left) { b.x = left * 2 - b.x; b.vx = Math.abs(b.vx); bounced = true; }
    if (b.x > right) { b.x = right * 2 - b.x; b.vx = -Math.abs(b.vx); bounced = true; }
    if (b.y < top) { b.y = top * 2 - b.y; b.vy = Math.abs(b.vy); bounced = true; }
    if (b.y > bottom) { b.y = bottom * 2 - b.y; b.vy = -Math.abs(b.vy); bounced = true; }
    if (bounced) { b.swayPhase = 10; b.grazed = false; game.audio.play('caromTap'); }
    return 'moving';
  }
  if (b.motion === 'chappySugar') {
    const leader = b.gridColumn === 0 && b.gridRow === 0;
    if (b.age < b.releaseAt) {
      b.x += Math.sin(b.age * 0.045 + b.swayPhase) * 0.11; b.y += 0.16;
      if (leader && b.age === b.releaseAt - 28) game.triggerBossCast();
      return 'harmless';
    }
    if (b.age === b.releaseAt) {
      b.delay = 0; b.vx = b.targetX; b.vy = b.targetY;
      if (leader) { game.audio.play('chappySnap'); game.spark(...game.bossPosition(), '#fff2cf', 16); }
    }
    b.x += b.vx; b.y += b.vy;
    return 'moving';
  }
  return undefined;
}
