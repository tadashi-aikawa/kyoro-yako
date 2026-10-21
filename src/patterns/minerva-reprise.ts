import { patternPosition } from '../boss-movement';
import type { Game } from '../game';
import { obsidiaPosition } from '../obsidia-movement';
import type { Difficulty } from '../rules';
import { STAGES } from '../stages';
import { emitClaudine } from './claudine';
import { emitJinraiPattern } from './jinrai';
import { emitNeo } from './neo';
import { emitObsidia, sweepPosition } from './obsidia';

export const REPRISE_PREPARE = 120;
const PATTERNS = ['vim', 'enter', 'clean', 'link', 'sweep', 'complement', 'type', 'grid', 'whiteSpace', 'jinraiKiss', 'jinraiLaser', 'jinraiSakura'];
export const REPRISES = STAGES.slice(0, 4).flatMap(stage => stage.phases
  .filter(phase => PATTERNS.includes(phase.pattern)).map(phase => ({ boss: stage.boss, phase })));
export interface Reprise { cycle: number; index: number; entry: [number, number]; startFrame: number; startHp: number; prayer: boolean; }
export const repriseLocal = (frame: number, reprise: Reprise): number => Math.max(0, frame - reprise.startFrame);
export function repriseDifficulty(difficulty: Difficulty): Difficulty {
  const levels = ['easy', 'normal', 'hard', 'lunatic'] as const;
  return levels[Math.min(3, levels.indexOf(difficulty) + 1)];
}

export function reprisePosition(frame: number, reprise: Reprise, difficulty: Difficulty): [number, number] {
  const local = repriseLocal(frame, reprise), { boss, phase } = REPRISES[reprise.index];
  const virtualFrame = 105 + Math.max(0, local - REPRISE_PREPARE);
  const target = phase.pattern === 'sweep' ? sweepPosition(virtualFrame, ['easy', 'normal', 'hard', 'lunatic'].indexOf(repriseDifficulty(difficulty)))
    : boss === 'obsidia' ? obsidiaPosition(phase.pattern, virtualFrame, reprise.entry)
    : patternPosition(phase, virtualFrame, reprise.entry)!;
  const progress = Math.max(0, Math.min(1, local / REPRISE_PREPARE));
  const ease = progress * progress * (3 - 2 * progress);
  return [reprise.entry[0] + (target[0] - reprise.entry[0]) * ease, reprise.entry[1] + (target[1] - reprise.entry[1]) * ease];
}

const views = new WeakMap<Game, Game>();
// 攻撃の時計・識別子・難易度を投影する。HP・全体時計・本体のキャラは実Gameに残す。
export function repriseView(game: Game): Game {
  if (game.phase?.pattern !== 'owlDawn' || !game.minervaReprise || game.minervaReprise.prayer) return game;
  let view = views.get(game);
  if (!view) {
    view = new Proxy(game, {
      get(target, property) {
        if (property === 'phase') return REPRISES[target.minervaReprise!.index].phase;
        if (property === 'phaseFrame') return 105 + repriseLocal(target.phaseFrame, target.minervaReprise!) - REPRISE_PREPARE;
        if (property === 'difficulty') return repriseDifficulty(target.difficulty);
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    views.set(game, view);
  }
  return view;
}

export function emitReprise(game: Game): void {
  const view = repriseView(game), pattern = view.phase!.pattern, t = view.phaseFrame - 105;
  if (t < 0 || game.bombFrames > 0) return;
  const boss = REPRISES[game.minervaReprise!.index].boss;
  if (boss === 'neo') emitNeo(view, pattern, t);
  else if (boss === 'obsidia') emitObsidia(view, pattern, t);
  else if (boss === 'claudine') emitClaudine(view, pattern, t);
  else emitJinraiPattern(view, pattern, t);
}
