import type { Game, Item } from '../game';
import { type ItemKind, MAX_POWER } from '../rules';
import type { Reprise } from './minerva-reprise';

export const AWAKENING_SILENCE = 60;
export const AWAKENING_SPEECH = 264;
export const AWAKENING_AURA = 60;
export const AWAKENING_HOLD = 60;
export const AWAKENING_LINE = '……';
export interface MinervaAwakening {
  stage: 'silence' | 'speech' | 'supply' | 'aura' | 'hold';
  frame: number;
  gifts: Item[];
}

export function awakeningAura(reprise: Reprise): number {
  const intro = reprise.finale;
  return !intro || intro.stage === 'hold' ? 1 : intro.stage === 'aura' ? Math.min(1, intro.frame / AWAKENING_AURA) : 0;
}

function supply(game: Game, intro: MinervaAwakening): void {
  const kinds: ItemKind[] = game.power >= MAX_POWER ? ['radiant'] : Array<ItemKind>(Math.ceil(MAX_POWER - game.power)).fill('large');
  kinds.push('bomb', 'life');
  const [x, y] = game.bossXY;
  for (const [index, kind] of kinds.entries()) {
    const offset = index - (kinds.length - 1) / 2;
    const item = game.spawnItem(x + offset * 12, y + 16, kind, true);
    if (!item) continue;
    Object.assign(item, { vx: offset * 0.35, vy: 1.2, manual: true, tossed: true, launchFrames: 24 });
    intro.gifts.push(item);
  }
}

export function updateAwakening(game: Game, reprise: Reprise): boolean {
  const intro = reprise.finale;
  if (!intro) return false;
  intro.frame++;
  if (intro.stage === 'silence' && intro.frame >= AWAKENING_SILENCE) {
    intro.stage = 'speech'; intro.frame = 0;
    game.showBattleComment(AWAKENING_LINE, AWAKENING_SPEECH);
  } else if (intro.stage === 'speech' && intro.frame >= AWAKENING_SPEECH) {
    game.battleComment = undefined; game.battleCommentFrames = 0;
    intro.stage = 'supply'; intro.frame = 0; supply(game, intro);
  } else if (intro.stage === 'supply' && intro.gifts.every(item => !item.active)) {
    intro.stage = 'aura'; intro.frame = 0;
  } else if (intro.stage === 'aura' && intro.frame >= AWAKENING_AURA) {
    intro.stage = 'hold'; intro.frame = 0;
    reprise.startFrame = game.phaseFrame;
  } else if (intro.stage === 'hold' && intro.frame >= AWAKENING_HOLD) {
    reprise.finale = undefined;
    return false;
  }
  return true;
}
