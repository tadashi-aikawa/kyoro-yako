import { patternPosition } from '../boss-movement';
import type { Game } from '../game';
import { obsidiaPosition } from '../obsidia-movement';
import type { Difficulty } from '../rules';
import { STAGES } from '../stages';
import { emitClaudine } from './claudine';
import { emitJinraiPattern } from './jinrai';
import { CLONE_FIRST_CHARGE, jinraiCloneScene } from './jinrai-clone';
import { reprisePrepare } from './minerva-summon';
import { emitNeo } from './neo';
import { emitObsidia, sweepPosition } from './obsidia';

export const REPRISE_PREPARE = 60;
const PATTERNS = ['vim', 'enter', 'link', 'sweep', 'type', 'grid', 'jinraiKiss', 'jinraiSakura', 'jinraiClone', 'jinraiPetal'];
export const REPRISES = STAGES.slice(0, 4).flatMap(stage => stage.phases
  .filter(phase => PATTERNS.includes(phase.pattern)).map(phase => ({ boss: stage.boss, phase })));
export interface Reprise { cycle: number; index: number; seen: number[]; entry: [number, number]; startFrame: number; startHp: number; prayer: boolean; supplied: boolean; difficulty: Difficulty; }
export function repriseIndex(seen: readonly number[], roll = Math.random()): number {
  const weights = REPRISES.map((_, index) => seen.includes(index) ? 1 : 4);
  let choice = roll * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < weights.length; index++) {
    choice -= weights[index];
    if (choice < 0) return index;
  }
  return REPRISES.length - 1;
}
export const repriseLocal = (frame: number, reprise: Reprise): number => Math.max(0, frame - reprise.startFrame);
function repriseFrame(frame: number, reprise: Reprise): number {
  const elapsed = repriseLocal(frame, reprise) - reprisePrepare(reprise);
  // 花影は単身射撃の前置きを省き、召喚後すぐに分身を始める。召喚中の時計は進めない。
  return 105 + elapsed + (elapsed >= 0 && REPRISES[reprise.index].phase.pattern === 'jinraiClone' ? CLONE_FIRST_CHARGE - 105 : 0);
}
export function repriseDifficulty(difficulty: Difficulty, hpRatio: number): Difficulty {
  const levels = ['easy', 'normal', 'hard', 'lunatic'] as const;
  return levels[Math.min(3, levels.indexOf(difficulty) + (hpRatio < 0.5 ? 1 : 0))];
}

export function reprisePosition(frame: number, reprise: Reprise, difficulty: Difficulty): [number, number] {
  const local = repriseLocal(frame, reprise), { boss, phase } = REPRISES[reprise.index];
  const virtualFrame = Math.max(105, repriseFrame(frame, reprise));
  const clone = phase.pattern === 'jinraiClone' ? jinraiCloneScene(virtualFrame, phase.duration).bodies[0] : undefined;
  const target = clone ? [clone.x, clone.y] : phase.pattern === 'sweep' ? sweepPosition(virtualFrame, ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty))
    : boss === 'obsidia' ? obsidiaPosition(phase.pattern, virtualFrame, reprise.entry)
    : patternPosition(phase, virtualFrame, reprise.entry)!;
  const progress = Math.max(0, Math.min(1, local / reprisePrepare(reprise)));
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
        if (property === 'phaseFrame') return repriseFrame(target.phaseFrame, target.minervaReprise!);
        if (property === 'difficulty') return target.minervaReprise!.difficulty;
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
