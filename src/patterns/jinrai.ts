import type { Game } from '../game';
import { SAKURA_PERIOD } from '../game';
import { bulletSpeed, DIFFICULTY, density, FIELD } from '../rules';
import { emitBossNormal } from './boss-normal';

export const BURST_MOVE = 18;
export const BURST_SHOTS = [48, 66, 84] as const;
export const BURST_RETURN = 96;
const BURST_DURATION = 120;
// 開始15秒から8秒ごと。煙で消え、中央へ瞬間移動して三連発散する。
export function dashBurstStep(frame: number): number { return frame >= 900 && (frame - 900) % 480 < BURST_DURATION ? (frame - 900) % 480 : -1; }
export function burstVisibility(step: number): number {
  if (step < 0 || step >= BURST_MOVE + 10) return 1;
  if (step < 6) return 1 - step / 6;
  if (step < BURST_MOVE) return 0;
  return (step - BURST_MOVE) / 10;
}
export function dashPosition(game: Game): [number, number] {
  const tick = Math.max(0, game.jinraiDashTick);
  const local = tick - (game.jinraiDashDouble && tick >= 85 ? 85 : 0);
  const warning = [30, 24, 20, 16][['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty)];
  const start = game.jinraiDashDirection > 0 ? 24 : 360;
  const x = local < warning ? start : local < warning + 22 ? start + game.jinraiDashDirection * (local - warning) * 16 : start + game.jinraiDashDirection * 336;
  return [x, game.jinraiDashY];
}
export function burstPosition(game: Game, step: number): [number, number] {
  if (step < BURST_MOVE) {
    return [game.jinraiBurstFromX, game.jinraiBurstFromY];
  }
  if (step < BURST_RETURN) return [192, 224];
  const crossing = game.jinraiDashCrossing + 1;
  const progress = (step - BURST_RETURN) / (BURST_DURATION - BURST_RETURN);
  return [192 + ((crossing % 2 ? 360 : 24) - 192) * progress, 224 + ([115, 170, 225][crossing % 3] - 224) * progress];
}

export function emitJinraiPattern(game: Game, pattern: string, t: number): void {
    const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
    if (pattern === 'jinraiDash') { emitJinraiDash(game, level); return; }
    const [x, y] = game.bossPosition();
    if (pattern === 'jinraiClone') {
      if (t === 0) game.audio.play('ninpo');
      for (const origin of game.bossTargets()) {
        if (t === 0) game.spark(origin[0], origin[1], '#ffcee9', 14);
        emitBossNormal(game, 'jinraiRapidFan', t, origin);
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
    if (pattern === 'jinraiBounce' && t % [118, 105, 94, 82][level] === 0) {
      const n = [3, 4, 5, 6][level];
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        const b = game.spawnBullet(x, y, side * (1.8 + level * 0.16), 0.9 + Math.floor(i / 2) * 0.25, 2, 'star');
        if (b) { b.motion = 'jinraiBounce'; b.radius = 8; b.delay = [43, 36, 30, 25][level]; }
      }
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
      if (t % [115, 100, 86, 74][level] === 0) game.jinraiMarks.push({ x: game.px, y: game.py, age: 0, warning: [60, 48, 42, 36][level] });
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
    const burst = dashBurstStep(game.phaseFrame);
    if (burst >= 0) {
      if (burst === 0) {
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
        const offset = (burst - BURST_SHOTS[0]) * 0.02 + Math.floor((game.phaseFrame - 900) / 480) * 0.3;
        for (let i = 0; i < n; i++) {
          if (i % (n / 4) === 0) continue;
          const angle = offset + i * Math.PI * 2 / n;
          const speed = 1.35 + level * 0.18;
          game.spawnBullet(192, 224, Math.cos(angle) * speed, Math.sin(angle) * speed, 2, 'needle');
          const petal = game.spawnBullet(192, 224, Math.cos(angle + 0.08) * speed * 0.65, Math.sin(angle + 0.08) * speed * 0.65, 3 + i % 3, 'petal');
          if (petal) petal.radius = 2.5;
        }
      }
      if (burst === BURST_DURATION - 1) game.jinraiDashTick = -1;
      return;
    }
    game.jinraiDashTick++;
    if (game.jinraiDashTick === 0 || game.jinraiDashTick >= (game.jinraiDashDouble ? 170 : 90)) {
      game.jinraiDashTick = 0;
      game.jinraiDashDouble = game.phaseHp <= game.phaseMaxHp * 0.5;
    }
    const tick = game.jinraiDashTick;
    const local = tick - (game.jinraiDashDouble && tick >= 85 ? 85 : 0);
    const warning = [30, 24, 20, 16][level];
    if (local === 0) {
      game.jinraiDashCrossing++;
      game.jinraiDashDirection = game.jinraiDashCrossing % 2 ? -1 : 1;
      game.jinraiDashY = [115, 170, 225][game.jinraiDashCrossing % 3];
      game.spark(game.jinraiDashDirection > 0 ? 24 : 360, game.jinraiDashY, '#fff2b8', 12);
    }
    const wave = game.jinraiDashCrossing;
    if (local >= warning && local < warning + 22) {
      const order = local - warning;
      const gap = 9 + wave % 4;
      if (order < gap || order >= gap + 2) {
        const [x, y] = game.bossPosition();
        const b = game.spawnBullet(x, y, game.jinraiDashDirection * 0.45, 0, 1, 'star');
        if (b) { b.motion = 'jinraiHold'; b.radius = 5; b.dashWave = wave; b.dashOrder = order; }
      }
    }
    if (local === warning + 28) game.bullets.forEach((b) => {
      if (b.motion === 'jinraiHold' && b.dashWave === wave) { b.vx = 0; b.vy = 0; b.color = 3; }
    });
    if (local === warning + 38) {
      game.audio.play('slash');
      game.jinraiDashFlashUntil = game.phaseFrame + 8;
      game.bullets.forEach((b) => {
        if (b.motion !== 'jinraiHold' || b.dashWave !== wave) return;
        b.targetX = game.px; b.targetY = game.py;
        b.releaseAt = game.phaseFrame + 8 + b.dashOrder * 2;
        b.color = 2;
      });
      game.spark(192, game.jinraiDashY, '#fff5c1', 24);
    }
  }

  export function updateJinraiHazards(game: Game): void {
    for (let i = game.jinraiLasers.length - 1; i >= 0; i--) {
      const laser = game.jinraiLasers[i];
      laser.age++;
      if (laser.age >= laser.life) { game.jinraiLasers.splice(i, 1); continue; }
      [laser.x, laser.y] = game.bossPosition();
      if (laser.age <= laser.warning) continue;
      if (laser.age === laser.warning + 1) game.audio.play('laser');
      laser.angle += laser.speed;
      const dx = game.px - laser.x;
      const dy = game.py - laser.y;
      const along = dx * Math.cos(laser.angle) + dy * Math.sin(laser.angle);
      const across = Math.abs(dx * Math.sin(laser.angle) - dy * Math.cos(laser.angle));
      if (along > 10 && along < 510 && across < 7 && game.invulnFrames <= 0 && !game.invincible && game.pendingHit < 0) { game.pendingHit = 0; game.hitDuringSpell = true; }
    }
    for (let i = game.jinraiMarks.length - 1; i >= 0; i--) {
      const mark = game.jinraiMarks[i];
      mark.age++;
      if (mark.age === mark.warning) {
        game.audio.play('thunder');
        const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
        for (let j = 0; j < 8 + level * 2; j++) {
          const angle = j * Math.PI * 2 / (8 + level * 2);
          game.spawnBullet(mark.x, mark.y, Math.cos(angle) * (0.85 + level * 0.1), Math.sin(angle) * (0.85 + level * 0.1), 2, 'orb');
        }
        game.spark(mark.x, mark.y, '#ffe775', 18);
      }
      if (mark.age >= mark.warning && mark.age < mark.warning + 18 && Math.abs(game.px - mark.x) < 6 && game.py <= mark.y + 8 && game.invulnFrames <= 0 && !game.invincible && game.pendingHit < 0) { game.pendingHit = 0; game.hitDuringSpell = true; }
      if (mark.age > mark.warning + 18) game.jinraiMarks.splice(i, 1);
    }
  }
