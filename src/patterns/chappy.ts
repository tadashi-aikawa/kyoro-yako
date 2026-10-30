import type { Bullet, Game } from '../game';
import { FIELD } from '../rules';

export const YOYO_WARNING = [66, 54, 48, 42] as const;
export const YOYO_FLIGHT = [210, 186, 168, 150] as const;
export const YOYO_REST = 30;
export const YOYO_BEADS = 3;
export const YOYO_STAGGER = 8;
export const YOYO_BOTTOM = FIELD.h - 3;
export const STITCH_BEAT = [102, 90, 78, 66] as const;
export const STITCH_PERIOD = [234, 210, 186, 162] as const;
export const STITCH_WARNING = 24;
export const STITCH_REVEAL = 42;
export const SUGAR_PERIOD = [300, 276, 252, 228] as const;
export const SUGAR_WARNING = [114, 102, 90, 84] as const;
export const SUGAR_CUE = 54;

export function chappyLevel(game: Game): number { return ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty); }
export function yoyoPeriod(level: number): number { return YOYO_WARNING[level] + YOYO_FLIGHT[level] + YOYO_STAGGER * (YOYO_BEADS - 1) + YOYO_REST; }

// 往復とも画面内で完結する。復路を別の弧にして、同じ場所を待つだけの往復にしない。
export function yoyoPoint(b: Bullet, progress: number): [number, number] {
  const angle = Math.PI * Math.max(0, Math.min(1, progress));
  return [b.targetX + (b.sway - b.targetX) * Math.sin(angle) + b.swayRate * Math.sin(angle * 2),
    b.targetY + (b.swayPhase - b.targetY) * Math.sin(angle)];
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
  if (pattern === 'chappyStitch' && t % STITCH_PERIOD[level] === 0) {
    const wave = Math.floor(t / STITCH_PERIOD[level]);
    for (let row = 0; row < 2; row++) for (let col = 0; col < 29; col++) {
      // 無害な導入は上端の外で済ませる。本体直下へ張り付いたまま撃てる帯を作らない。
      const b = game.spawnBullet(24 + col * 12, -64 + row * 28 + col % 2 * 6, 0, [0.8, 1.0, 1.18, 1.36][level], row ? 3 : 1);
      if (!b) continue;
      b.motion = 'chappyStitch'; b.radius = [2.7, 3, 3.2, 3.4][level];
      b.targetX = b.x; b.gridColumn = col; b.gridRow = row; b.swayPhase = wave * 0.7;
      b.dashWave = (wave + row) % 2; b.dashOrder = 0; b.launchSoundPending = false;
    }
    game.audio.play('enemyShot'); game.triggerBossCast();
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
    const period = yoyoPeriod(level), local = (b.age - 1) % period, wave = Math.floor((b.age - 1) / period);
    if (local === 0) {
      const [x, y] = game.bossPosition(); b.targetX = x; b.targetY = y;
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
    b.y += b.vy;
    const nx = b.targetX + Math.sin((b.y - 140) * 0.019 + b.swayPhase) * 16;
    b.vx = nx - b.x; b.x = nx;
    const beat = STITCH_BEAT[level], step = (game.phaseFrame - 105 + b.dashWave * beat) % (beat * 2);
    const previous = b.dashOrder;
    const firstSolid = (game.phaseFrame - 105 + STITCH_REVEAL - b.age + b.dashWave * beat) % (beat * 2) < beat;
    // 新しい列の無害時間と全体の拍がずれても、次の実体化まで24フレームの合図を省かない。
    const approaching = step >= beat * 2 - STITCH_WARNING;
    b.dashOrder = b.age < STITCH_REVEAL ? approaching || firstSolid && b.age >= STITCH_REVEAL - STITCH_WARNING ? 1 : 0
      : step < beat ? 2 : step >= beat * 2 - STITCH_WARNING ? 1 : 0;
    if (previous !== 2 && b.dashOrder === 2 && b.gridColumn === 0) game.audio.play('split');
    if (b.y > FIELD.h + 20) b.active = false;
    b.delay = b.dashOrder === 2 ? 0 : 1;
    return !b.active || b.dashOrder !== 2 || b.y < 0 ? 'harmless' : 'moving';
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
