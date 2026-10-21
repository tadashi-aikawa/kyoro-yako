import type { Game } from '../game';
import type { Difficulty } from '../rules';
import { emitReprise, REPRISES, type Reprise, repriseLocal, reprisePosition } from './minerva-reprise';

export const PRAYER_PERIOD = 360;
export const PRAYER_CHARGE = 72;
export const PRAYER_FIRE = 180;
export function dawnPrayerStep(frame: number, reprise?: Reprise): number {
  return reprise?.prayer ? repriseLocal(frame, reprise) % PRAYER_PERIOD : -1;
}
export function dawnPosition(frame: number, reprise?: Reprise, difficulty: Difficulty = 'normal'): [number, number] {
  const usual: [number, number] = [192 + Math.sin(frame * 0.012) * 42, 132 + Math.sin(frame * 0.018) * 4];
  if (reprise && frame >= 105) {
    const step = dawnPrayerStep(frame, reprise);
    if (step < 0) return reprisePosition(frame, reprise, difficulty);
    const from: [number, number] = repriseLocal(frame, reprise) < PRAYER_PERIOD ? reprise.entry
      : [192 + Math.sin((frame - step - 1) * 0.012) * 42, 132 + Math.sin((frame - step - 1) * 0.018) * 4];
    const charge = Math.min(1, step / 60), chargeEase = charge * charge * (3 - 2 * charge);
    const fixed: [number, number] = [from[0] + (192 - from[0]) * chargeEase, from[1] + (132 - from[1]) * chargeEase];
    const progress = Math.max(0, (step - PRAYER_CHARGE - PRAYER_FIRE) / (PRAYER_PERIOD - PRAYER_CHARGE - PRAYER_FIRE));
    const ease = progress * progress * (3 - 2 * progress);
    return [fixed[0] + (usual[0] - fixed[0]) * ease, fixed[1] + (usual[1] - fixed[1]) * ease];
  }
  return usual;
}

export function emitDawn(game: Game): void {
  if (game.phaseHp <= 0) return;
  const previous = game.minervaReprise;
  if (game.bombFrames > 0) game.clearAttackEffects();
  if (!previous || previous.startHp - game.phaseHp >= game.phaseMaxHp * 0.05) {
    const cycle = previous ? previous.cycle + 1 : 0;
    const prayer = cycle % 9 === 3 || cycle % 9 === 8;
    const entry = dawnPosition(game.phaseFrame - 1, previous, game.difficulty);
    game.clearAttackEffects();
    game.minervaReprise = { cycle, index: prayer ? previous!.index : Math.floor(Math.random() * REPRISES.length), entry,
      startFrame: game.phaseFrame, startHp: game.phaseHp, prayer };
    game.jinraiWindDirection = Math.random() < 0.5 ? -1 : 1;
  }
  const cycle = game.minervaReprise!.cycle;
  const prayer = dawnPrayerStep(game.phaseFrame, game.minervaReprise);
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
  const direction = cycle % 9 === 8 ? -1 : 1;
  const rotation = direction * fireTime * 0.027;
  // 1回の祈りで1度だけ抽選する。下へ向かう1発を実物の補給アイテムへ置き換える。
  const giftRoll = repriseLocal(game.phaseFrame, game.minervaReprise!) === PRAYER_CHARGE + 72 ? Math.random() : 1;
  const gift = giftRoll < 0.05 ? 'life' : giftRoll < 0.30 ? 'bomb' : undefined;
  const giftArm = ((Math.round(-rotation * arms / (Math.PI * 2)) % arms) + arms) % arms;
  for (let i = 0; i < arms; i++) {
    const angle = Math.PI / 2 + rotation + i * Math.PI * 2 / arms, speed = [2.6, 3.0, 3.6, 4.2][level];
    if (gift && i === giftArm) {
      const item = game.spawnItem(x + Math.cos(angle) * 22, y + Math.sin(angle) * 22, gift, false);
      if (item) { item.vx = Math.cos(angle) * 1.5; item.vy = Math.sin(angle) * 1.5; item.manual = true; }
      continue;
    }
    const b = game.spawnBullet(x + Math.cos(angle) * 22, y + Math.sin(angle) * 22, Math.cos(angle) * speed, Math.sin(angle) * speed, i % 2 ? 1 : 2, 'orb');
    if (b) b.radius = 2.3;
  }
  // 後半は発散の途中から反対の渦を重ねる。主渦を保ち、追加は半分の頻度にする。
  if (game.phaseHp <= game.phaseMaxHp * 0.5 && fireTime >= 72 && fireTime % ([4, 3, 2, 2][level] * 2) === 0) {
    for (let i = 0; i < arms; i++) {
      const angle = Math.PI / 2 - rotation + (i + 0.5) * Math.PI * 2 / arms;
      const speed = [2.3, 2.7, 3.2, 3.7][level];
      const b = game.spawnBullet(x + Math.cos(angle) * 22, y + Math.sin(angle) * 22, Math.cos(angle) * speed, Math.sin(angle) * speed, 3, 'star');
      if (b) b.radius = 2.3;
    }
  }
}
