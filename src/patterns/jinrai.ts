import type { Game } from '../game';
import { SAKURA_PERIOD } from '../game';
import { bulletSpeed, DIFFICULTY, density, FIELD } from '../rules';
import { emitBossNormal } from './boss-normal';
import { CLONE_CHARGE, jinraiCloneScene } from './jinrai-clone';
import { emitJinraiKiss } from './jinrai-kiss';
import { emitThunder, updateThunder } from './jinrai-thunder';

export const BURST_MOVE = 18;
export const BURST_SHOTS = [48, 66, 84] as const;
export const BURST_RETURN = 96;
export const BURST_SPEED = 5.6;
export const BURST_PETAL_RATIO = 0.92;
export const DASH_CHARGE = 240;
export const DASH_CHARGE_START = 90;
export const DASH_CUTIN = DASH_CHARGE_START + 60;
export const DASH_CHARGED = DASH_CHARGE_START + DASH_CHARGE;
export const DASH_ATTACK = DASH_CHARGED + 30;
export const DASH_MOVE = 24;
export const DASH_DROP = 50;
export const DASH_START_Y = [115, 165, 215] as const;
export const DASH_TRAIL_LIFE = 36;

export function dashMotion(game: Game): { local: number; warning: number; moving: boolean } {
  const tick = Math.max(0, game.jinraiDashTick);
  const local = tick - (game.jinraiDashDouble && tick >= 85 ? 85 : 0);
  const warning = [30, 24, 20, 16][['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty)];
  return { local, warning, moving: local >= warning && local < warning + DASH_MOVE };
}

export function dashCrossingX(direction: number, elapsed: number): number {
  const p = Math.max(0, Math.min(1, elapsed / DASH_MOVE));
  const ease = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
  return (direction > 0 ? 24 : 360) + direction * 336 * ease;
}

export function dashCrossingPoint(direction: number, startY: number, elapsed: number): [number, number] {
  const x = dashCrossingX(direction, elapsed);
  const progress = Math.abs(x - (direction > 0 ? 24 : 360)) / 336;
  return [x, startY + DASH_DROP * progress];
}
const BURST_DURATION = 120;
// 前回の発散開始から8秒以上経ち、横断・往復を終えた区切りで三連発散する。
export function dashBurstStep(game: Game): number {
  const elapsed = game.phaseFrame - game.jinraiBurstStartFrame;
  return game.jinraiBurstStartFrame >= 0 && elapsed >= 0 && elapsed < BURST_DURATION ? elapsed : -1;
}
export function burstVisibility(step: number): number {
  if (step < 0 || step >= BURST_MOVE + 10) return 1;
  if (step < 6) return 1 - step / 6;
  if (step < BURST_MOVE) return 0;
  return (step - BURST_MOVE) / 10;
}
export function dashPosition(game: Game, entry: [number, number] = [192, 132]): [number, number] {
  if (game.phaseFrame < DASH_ATTACK) {
    if (game.phaseFrame < DASH_CHARGED) {
      const progress = Math.min(1, game.phaseFrame / DASH_CHARGE_START);
      const ease = progress * progress * (3 - 2 * progress);
      return [entry[0] + (192 - entry[0]) * ease, entry[1] + (132 - entry[1]) * ease];
    }
    const progress = (game.phaseFrame - DASH_CHARGED) / (DASH_ATTACK - DASH_CHARGED);
    const ease = progress * progress * (3 - 2 * progress);
    return [192 - 168 * ease, 132 - 17 * ease];
  }
  const { local, warning } = dashMotion(game);
  return dashCrossingPoint(game.jinraiDashDirection, game.jinraiDashY, local - warning);
}
export function burstPosition(game: Game, step: number): [number, number] {
  if (step < BURST_MOVE) {
    return [game.jinraiBurstFromX, game.jinraiBurstFromY];
  }
  if (step < BURST_RETURN) return [192, 224];
  const crossing = game.jinraiDashCrossing + 1;
  const progress = (step - BURST_RETURN) / (BURST_DURATION - BURST_RETURN);
  return [192 + ((crossing % 2 ? 360 : 24) - 192) * progress, 224 + (DASH_START_Y[crossing % 3] - 224) * progress];
}

export function emitJinraiPattern(game: Game, pattern: string, t: number): void {
    const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
    if (pattern === 'jinraiDash') { emitJinraiDash(game, level); return; }
    const [x, y] = game.bossPosition();
    if (pattern === 'jinraiClone') {
      const scene = jinraiCloneScene(game.phaseFrame, game.phase?.duration);
      if (game.phaseFrame === scene.chargeStart) {
        game.bullets.clear();
        game.audio.play('prayerCharge');
        for (const body of scene.bodies) game.spark(body.x, body.y, '#e2c9ff', 18);
      }
      if (game.phaseFrame === scene.chargeStart + CLONE_CHARGE) game.audio.play('ninpo');
      // 跳んでいる分身は撃たない。斉射の拍は全員で共有し、戻った分身は次の斉射から加わる。
      if (scene.shotFrame >= 0) for (const [index, body] of scene.bodies.entries()) {
        if (scene.firing[index]) emitBossNormal(game, 'jinraiRapidFan', scene.shotFrame, [body.x, body.y]);
      }
      return;
    }
    if (pattern === 'jinraiFan') {
      const beat = [132, 114, 98, 84][level];
      const step = t % beat;
      if (step === 0 || step === 18) {
        const n = [9, 13, 17, 21][level];
        const wave = Math.floor(t / beat);
        const aim = Math.PI / 2 + Math.sin(wave * 0.9) * 0.3 + (step === 0 ? -0.14 : 0.14);
        for (let i = 0; i < n; i++) {
          const angle = aim + (i / (n - 1) - 0.5) * Math.PI * 0.85;
          const velocity = bulletSpeed(game.difficulty, 2.1);
          const b = game.spawnBullet(x, y, Math.cos(angle) * velocity, Math.sin(angle) * velocity, step === 0 ? 2 : 3, 'needle');
          if (b) b.radius = 2.4;
        }
        game.spark(x, y, '#e4c8ff', 8);
      }
      return;
    }
    if (pattern === 'jinraiKiss') {
      emitJinraiKiss(game, t, level);
      return;
    }
    if (pattern === 'jinraiLaser') {
      if (t % 300 === 0) {
        const n = [3, 4, 5, 6][level];
        const offset = Math.atan2(game.py - y, game.px - x) + Math.PI / n;
        for (let i = 0; i < n; i++) game.jinraiLasers.push({ x, y, angle: offset + i * Math.PI * 2 / n, age: 0, warning: [75, 60, 50, 42][level], life: 260, speed: 0.003 + level * 0.0007 });
      }
      if (t % [46, 40, 34, 30][level] === 0) for (let i = 0; i < 2 + (level === 3 ? 1 : 0); i++) {
        const bx = 45 + (t * 7 + i * 131) % 290;
        const b = game.spawnBullet(bx, 42, Math.sin(t * 0.02 + i) * 0.17, 0.68 + level * 0.1, 3, 'petal');
        if (b) b.motion = 'wing';
      }
      return;
    }
    if (pattern === 'jinraiThunder') {
      emitThunder(game, t);
      return;
    }
    if (pattern === 'jinraiSakura') {
      if (t >= SAKURA_PERIOD && t % SAKURA_PERIOD === [84, 60, 48, 36][level]) game.audio.play('wind');
      if (t >= SAKURA_PERIOD && t % SAKURA_PERIOD === 0) game.jinraiWindDirection = Math.random() < 0.5 ? -1 : 1;
      if (t % [15, 12, 10, 9][level] === 0) {
        const count = [3, 4, 5, 6][level];
        for (let i = 0; i < count; i++) {
          const fromBoss = i % 2 === 0;
          const bx = fromBoss ? x + (Math.random() - 0.5) * 112 : 16 + Math.random() * (FIELD.w - 32);
          const by = fromBoss ? y + (Math.random() - 0.5) * 32 : -12;
          const b = game.spawnBullet(bx, by, (Math.random() - 0.5) * 0.25,
            [0.75, 0.95, 1.15, 1.35][level] + Math.random() * 0.6, 3 + Math.floor(Math.random() * 3), 'petal');
          if (b) {
            b.motion = 'jinraiSakura'; b.radius = 2.2;
            b.sway = 8 + Math.random() * 17;
            b.swayRate = 0.025 + Math.random() * 0.045;
            b.swayPhase = Math.random() * Math.PI * 2;
            b.rotation = Math.random() * Math.PI * 2;
            b.spin = (Math.random() < 0.5 ? -1 : 1) * (0.018 + Math.random() * 0.045);
          }
        }
      }
      return;
    }
    if (pattern === 'jinraiPetal') {
      // 初期版の花魁弾幕を復活。発射角を少しずつ回す花びらの螺旋。
      const unit = 0.9 + (DIFFICULTY[game.difficulty] - 1) * 0.18;
      if (t % Math.max(4, Math.round(7 / DIFFICULTY[game.difficulty])) === 0) {
        const arms = density(game.difficulty, 6);
        for (let i = 0; i < arms; i++) {
          const angle = t * 0.035 + i * Math.PI * 2 / arms;
          const b = game.spawnBullet(x, y, Math.cos(angle) * 1.1 * unit, Math.sin(angle) * 1.1 * unit, 3, 'petal');
          if (b) b.radius = 2.8;
        }
      }
    }
  }

  function emitJinraiDash(game: Game, level: number): void {
    while (game.jinraiDashTrails.length && game.phaseFrame - game.jinraiDashTrails[0].frame >= DASH_TRAIL_LIFE) game.jinraiDashTrails.shift();
    if (game.phaseFrame < DASH_ATTACK) return;
    const lowHp = game.phaseHp <= game.phaseMaxHp * 0.5;
    const crossingEnd = game.jinraiDashTick === (game.jinraiDashDouble ? 169 : 89);
    const burstReady = game.jinraiBurstStartFrame < 0 || game.phaseFrame - game.jinraiBurstStartFrame >= 480;
    if (lowHp && burstReady && crossingEnd) {
      game.jinraiBurstStartFrame = game.phaseFrame;
      game.jinraiBurstCount++;
    }
    const burst = dashBurstStep(game);
    if (burst >= 0) {
      if (burst === 0) {
        // 発散への切替時に発射待ちの列を残さない。
        game.bullets.forEach((b) => { if (b.motion === 'jinraiHold') b.active = false; });
        [game.jinraiBurstFromX, game.jinraiBurstFromY] = dashPosition(game);
        game.audio.play('ninpo');
        game.spark(game.jinraiBurstFromX, game.jinraiBurstFromY, '#d8c9ec', 22);
      }
      if (burst === BURST_MOVE) { game.audio.play('ninpo'); game.spark(192, 224, '#f1dbff', 26); }
      if (BURST_SHOTS.some((shot) => shot === burst)) {
        game.audio.play('thunderBurst'); game.audio.play('wind');
        game.jinraiBurstFlashUntil = game.phaseFrame + 12;
        game.spark(192, 224, '#fff3b0', 32);
        const n = [24, 32, 40, 48][level];
        const offset = (burst - BURST_SHOTS[0]) * 0.02 + (game.jinraiBurstCount - 1) * 0.3;
        // 通常攻撃(5.1×unit)より気持ち速く。花びらも通常攻撃を下回らない速さで後を追う。
        const speed = bulletSpeed(game.difficulty, BURST_SPEED);
        for (let i = 0; i < n; i++) {
          if (i % (n / 4) === 0) continue;
          const angle = offset + i * Math.PI * 2 / n;
          const bolt = game.spawnBullet(192, 224, Math.cos(angle) * speed, Math.sin(angle) * speed, 2, 'needle');
          if (bolt) bolt.motion = 'jinraiSpark';
          const petal = game.spawnBullet(192, 224, Math.cos(angle + 0.08) * speed * BURST_PETAL_RATIO, Math.sin(angle + 0.08) * speed * BURST_PETAL_RATIO, 3 + i % 3, 'petal');
          if (petal) { petal.radius = 2.5; petal.motion = 'jinraiSpark'; }
        }
      }
      if (burst === BURST_DURATION - 1) game.jinraiDashTick = -1;
      return;
    }
    game.jinraiDashTick++;
    if (game.jinraiDashTick === 0 || game.jinraiDashTick >= (game.jinraiDashDouble ? 170 : 90)) {
      game.jinraiDashTick = 0;
      game.jinraiDashDouble = lowHp;
    }
    const { local, warning } = dashMotion(game);
    if (local === 0) {
      game.jinraiDashCrossing++;
      game.jinraiDashDirection = game.jinraiDashCrossing % 2 ? -1 : 1;
      game.jinraiDashY = DASH_START_Y[game.jinraiDashCrossing % 3];
      game.spark(game.jinraiDashDirection > 0 ? 24 : 360, game.jinraiDashY, '#fff2b8', 12);
    }
    const wave = game.jinraiDashCrossing;
    if (local === warning) game.audio.play('jinraiWarp');
    if (local >= warning && local <= warning + DASH_MOVE) {
      // 加速しても弾列の16px間隔と切れ目を保つ。通過した位置だけを埋める。
      const step = local - warning;
      const start = game.jinraiDashDirection > 0 ? 24 : 360;
      const previous = step === 0 ? -1 : Math.floor(Math.abs(dashCrossingX(game.jinraiDashDirection, step - 1) - start) / 16 + 1e-8);
      const current = Math.floor(Math.abs(dashCrossingX(game.jinraiDashDirection, step) - start) / 16 + 1e-8);
      // 加速区間にも等間隔の残像を置き、低速の両端で重ねすぎない。
      const previousTrail = step === 0 ? -1 : Math.floor(Math.abs(dashCrossingX(game.jinraiDashDirection, step - 1) - start) / 24 + 1e-8);
      const currentTrail = Math.floor(Math.abs(dashCrossingX(game.jinraiDashDirection, step) - start) / 24 + 1e-8);
      for (let order = previousTrail + 1; order <= currentTrail; order++) {
        const x = start + game.jinraiDashDirection * order * 24;
        const y = game.jinraiDashY + DASH_DROP * order / 14;
        game.jinraiDashTrails.push({ x, y, frame: game.phaseFrame, direction: game.jinraiDashDirection, wave });
      }
      for (let order = previous + 1; order <= current; order++) {
        const gap = 9 + wave % 4;
        if (order >= gap && order < gap + 2) continue;
        const b = game.spawnBullet(start + game.jinraiDashDirection * order * 16, game.jinraiDashY + DASH_DROP * order / 21, 0, 0, 1, 'star');
        if (b) { b.motion = 'jinraiHold'; b.radius = 5; b.dashWave = wave; b.dashOrder = order; }
      }
    }
    if (local === warning + 28) game.bullets.forEach((b) => {
      if (b.motion === 'jinraiHold' && b.dashWave === wave) { b.vx = 0; b.vy = 0; b.color = 3; }
    });
    if (local === warning + 38) {
      game.audio.play('slash');
      game.bullets.forEach((b) => {
        if (b.motion !== 'jinraiHold' || b.dashWave !== wave) return;
        b.targetX = game.px; b.targetY = game.py;
        b.releaseAt = game.phaseFrame + 8 + b.dashOrder * 2;
        b.color = 2;
      });
      game.spark(192, game.jinraiDashY + DASH_DROP / 2, '#fff5c1', 24);
    }
  }

  export function updateJinraiHazards(game: Game): void {
    for (let i = game.jinraiLasers.length - 1; i >= 0; i--) {
      const laser = game.jinraiLasers[i];
      laser.age++;
      if (laser.age >= laser.life) { game.jinraiLasers.splice(i, 1); continue; }
      [laser.x, laser.y] = game.bossPosition();
      if (laser.age <= laser.warning) continue;
      if (laser.age === laser.warning + 1) { game.triggerBossCast(); game.audio.play('laser'); }
      laser.angle += laser.speed;
      const dx = game.px - laser.x;
      const dy = game.py - laser.y;
      const along = dx * Math.cos(laser.angle) + dy * Math.sin(laser.angle);
      const across = Math.abs(dx * Math.sin(laser.angle) - dy * Math.cos(laser.angle));
      if (along > 10 && along < 510 && across < 7 && game.invulnFrames <= 0 && !game.invincible && game.pendingHit < 0) { game.pendingHit = 0; game.hitDuringSpell = true; }
    }
    updateThunder(game);
  }
