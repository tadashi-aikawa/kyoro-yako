import type { Game } from '../game';

export interface GalaxyFlash { x: number; y: number; angle: number; age: number; warning: number; width: number; }
export const GALAXY_PERIOD = 360;
export const GALAXY_FIRE = 90;

export function emitGalaxyFlash(game: Game, t: number): void {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const dawn = game.phase?.pattern === 'galaxyFlashDawn';
  // 強化版は固定照準の光線に星の輪を重ねる。予告後に照準を動かさない。
  if (dawn && t % 75 === 0) {
    const [x, y] = game.bossPosition();
    const count = [18, 24, 30, 36][level];
    for (let i = 0; i < count; i++) {
      const angle = (i + t / 300) * Math.PI * 2 / count;
      game.spawnBullet(x, y, Math.cos(angle) * 1.15, Math.sin(angle) * 1.15, i % 2 ? 0 : 2, 'star');
    }
  }
  if (t % (dawn ? 300 : GALAXY_PERIOD) !== 0) return;
  const [x, y] = game.bossPosition();
  game.galaxyFlash = { x, y, angle: Math.atan2(Math.max(90, game.py - y), game.px - x), age: 0, warning: (dawn ? [90, 78, 66, 54] : [108, 90, 76, 64])[level], width: (dawn ? [48, 56, 64, 72] : [32, 40, 48, 56])[level] };
  game.audio.play('prayerCharge');
}

export function updateGalaxyFlash(game: Game): void {
  const beam = game.galaxyFlash;
  if (!beam) return;
  beam.age++;
  if (beam.age > beam.warning + GALAXY_FIRE) { game.galaxyFlash = undefined; return; }
  if (beam.age <= beam.warning) return;
  if (beam.age === beam.warning + 1) {
    game.triggerBossCast(); game.audio.play('laser'); game.flash = 8;
    const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
    const dawn = game.phase?.pattern === 'galaxyFlashDawn';
    const count = [10, 14, 18, 22][level] + (dawn ? 8 : 0);
    for (let i = 0; i < count; i++) {
      const a = (i + 0.5) * Math.PI * 2 / count;
      game.spawnBullet(beam.x, beam.y, Math.cos(a) * (0.85 + level * 0.15), Math.sin(a) * (0.85 + level * 0.15), i % 2 ? 0 : 1, 'star');
    }
  }
  const dx = game.px - beam.x, dy = game.py - beam.y;
  const along = dx * Math.cos(beam.angle) + dy * Math.sin(beam.angle);
  const across = Math.abs(dx * Math.sin(beam.angle) - dy * Math.cos(beam.angle));
  if (along >= 0 && along < 580 && across < beam.width / 2 + 2.5 && game.invulnFrames <= 0 && !game.invincible && game.pendingHit < 0) {
    game.pendingHit = 0; game.hitDuringSpell = true;
  }
}

export function emitEtokichi(game: Game, t: number): void {
  if (t % 390 !== 0) return;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const count = [8, 10, 12, 14][level];
  const [x, y] = game.bossPosition();
  for (let i = 0; i < count; i++) {
    const angle = i * Math.PI * 2 / count;
    const b = game.spawnBullet(x + Math.cos(angle) * 72, y + Math.sin(angle) * 23, 0, 0, 2, 'star');
    if (!b) continue;
    b.motion = 'etoileOrbit';
    b.targetX = x; b.targetY = y;
    b.swayPhase = angle;
    b.releaseAt = [105, 88, 76, 66][level] + i * [37, 31, 26, 22][level];
    b.swayRate = [0.009, 0.011, 0.013, 0.015][level];
  }
}
