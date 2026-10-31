import type { Game } from '../game';
import { SAKURA_PERIOD } from '../game';
import { bulletSpeed, DIFFICULTY, density, FIELD } from '../rules';
import { emitBossNormal } from './boss-normal';
import { CLONE_CHARGE, jinraiCloneScene } from './jinrai-clone';
import { emitIssen } from './jinrai-issen';
import { emitJinraiKiss } from './jinrai-kiss';
import { emitThunder, updateThunder } from './jinrai-thunder';

export { DASH_ATTACK, DASH_CHARGE, DASH_CHARGE_START, DASH_CHARGED, DASH_CUTIN } from './jinrai-issen';

export function emitJinraiPattern(game: Game, pattern: string, t: number): void {
    const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
    if (pattern === 'jinraiDash') { emitIssen(game, level); return; }
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
