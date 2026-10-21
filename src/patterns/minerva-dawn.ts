import type { Game } from '../game';
import type { Difficulty } from '../rules';
import { emitReprise, REPRISE_TIME, REPRISES, type Reprise, reprisePosition } from './minerva-reprise';

export const PRAYER_PERIOD = 360;
export const PRAYER_CHARGE = 72;
export const PRAYER_FIRE = 180;
export const DAWN_CYCLE = REPRISE_TIME + PRAYER_PERIOD;
export function dawnPrayerStep(frame: number): number {
  if (frame < 105) return -1;
  const local = (frame - 105) % DAWN_CYCLE;
  return local < REPRISE_TIME ? -1 : local - REPRISE_TIME;
}
export function dawnPosition(frame: number, reprise?: Reprise, difficulty: Difficulty = 'normal'): [number, number] {
  const usual: [number, number] = [192 + Math.sin(frame * 0.012) * 42, 132 + Math.sin(frame * 0.018) * 4];
  if (reprise && frame >= 105 && Math.floor((frame - 105) / DAWN_CYCLE) === reprise.cycle) {
    const step = dawnPrayerStep(frame);
    if (step < 0) return reprisePosition(frame, reprise, difficulty);
    const from = reprisePosition(frame - step - 1, reprise, difficulty);
    const charge = Math.min(1, step / 60), chargeEase = charge * charge * (3 - 2 * charge);
    const fixed: [number, number] = [from[0] + (192 - from[0]) * chargeEase, from[1] + (132 - from[1]) * chargeEase];
    const progress = Math.max(0, (step - PRAYER_CHARGE - PRAYER_FIRE) / (PRAYER_PERIOD - PRAYER_CHARGE - PRAYER_FIRE));
    const ease = progress * progress * (3 - 2 * progress);
    return [fixed[0] + (usual[0] - fixed[0]) * ease, fixed[1] + (usual[1] - fixed[1]) * ease];
  }
  return usual;
}

export function emitDawn(game: Game): void {
  const cycle = Math.floor((game.phaseFrame - 105) / DAWN_CYCLE);
  const prayer = dawnPrayerStep(game.phaseFrame);
  if (game.bombFrames > 0) game.clearAttackEffects();
  if (!game.minervaReprise || game.minervaReprise.cycle !== cycle) {
    game.clearAttackEffects();
    const entry = dawnPosition(game.phaseFrame - 1, game.minervaReprise, game.difficulty);
    game.minervaReprise = { cycle, index: Math.floor(Math.random() * REPRISES.length), entry };
    game.jinraiWindDirection = Math.random() < 0.5 ? -1 : 1;
  }
  if (prayer === 0) { game.clearAttackEffects(); game.audio.play('prayerCharge'); }
  if (game.bombFrames > 0) {
    const view = game.attackContext(), time = view.phaseFrame - 105;
    if (view.phase?.pattern === 'jinraiSakura' && time >= 300 && time % 300 === 0) game.jinraiWindDirection = Math.random() < 0.5 ? -1 : 1;
    return;
  }
  if (prayer < 0) { emitReprise(game); return; }
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const fireTime = prayer - PRAYER_CHARGE;
  if (fireTime < 0 || fireTime >= PRAYER_FIRE || fireTime % [4, 3, 2, 2][level] !== 0) return;
  if (fireTime === 0) game.audio.play('laser');
  if (fireTime % 12 === 0) game.audio.play('split');
  const [x, y] = game.bossPosition(), arms = [5, 7, 9, 11][level];
  const rotation = (cycle % 2 ? -1 : 1) * fireTime * 0.027;
  for (let i = 0; i < arms; i++) {
    const angle = Math.PI / 2 + rotation + i * Math.PI * 2 / arms, speed = [2.6, 3.0, 3.6, 4.2][level];
    const b = game.spawnBullet(x + Math.cos(angle) * 22, y + Math.sin(angle) * 22, Math.cos(angle) * speed, Math.sin(angle) * speed, i % 2 ? 1 : 2, 'orb');
    if (b) b.radius = 2.3;
  }
}
