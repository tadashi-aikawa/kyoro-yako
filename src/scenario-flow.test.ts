import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dialogue, FINAL_COMMENTS } from './dialogue';
import { CREDITS_ROLL_FRAMES } from './ending';
import { Game } from './game';
import { STAGES } from './stages';
import { INVITATION, RECORDS } from './story';

const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void> = {};
const run = (game: Game, frames: number) => { for (let i = 0; i < frames; i++) game.update(); };
function press(game: Game, code: string): void {
  listeners.keydown({ code, repeat: false, preventDefault: () => {} }); game.update();
  listeners.keyup({ code, repeat: false, preventDefault: () => {} });
}
beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('Image', class { src = ''; });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof listeners[string]) => { listeners[kind] = listener; } });
});
afterEach(() => vi.unstubAllGlobals());

it('新規プレイは匿名の招待状とみみこの反応を読んでから道中を始める', () => {
  const game = new Game(); press(game, 'KeyZ'); press(game, 'KeyZ');
  expect(game.scene).toBe('letter'); run(game, 120); expect(game.stageFrame).toBe(0);
  expect(INVITATION.join('')).not.toContain('ミネルヴァ');
  expect(RECORDS.slice(0, 4).flatMap(record => record.lines).join('')).not.toContain('ミネルヴァ');
  press(game, 'KeyZ'); expect(game.scene).toBe('dialogue'); expect(game.boss).toBeUndefined();
  for (const _ of game.lines) press(game, 'KeyZ');
  expect(game.scene).toBe('stage'); expect(game.stageFrame).toBe(0);
  expect(dialogue('mimiko', 'minerva', 'before').some(line => line.text.includes('あなたが送ったの'))).toBe(true);
});

it.each([1, 2, 3, 4, 5])('%s階の最終技前は安全に移動し、4秒話してから技の時計を始める', stage => {
  const game = new Game(); game.startStage(stage); game.startBoss(false, STAGES[stage - 1].phases.length - 2);
  game.phaseHp = 0; game.update();
  expect(game.finaleIntro?.frame).toBe(0); expect(game.cutin).toBe(0); expect(game.phaseFrame).toBe(0);
  game.keys.add('KeyZ'); run(game, 60); expect(game.shots.count).toBe(0);
  expect(game.bossXY).toEqual(stage === 2 ? [192, 150] : [192, 132]);
  expect(game.battleComment?.text).toBe(FINAL_COMMENTS[game.boss!]);
  expect(game.battleCommentFrames).toBe(240);
  press(game, 'Escape'); const frame = game.finaleIntro!.frame; run(game, 60);
  expect(game.finaleIntro!.frame).toBe(frame); expect(game.battleCommentFrames).toBe(239);
  press(game, 'Escape'); run(game, 240);
  expect(game.finaleIntro).toBeUndefined(); expect(game.phaseFrame).toBe(0);
  expect(game.phaseHp).toBe(game.phaseMaxHp);
  game.update(); expect(game.phaseFrame).toBe(1);
});

it('最終技前のリトライで演出とコメントを持ち越さない', () => {
  const game = new Game(); game.startStage(1); game.startBoss(false, 5); game.skipPhase(); run(game, 70);
  expect(game.battleComment).toBeDefined(); game.startStage(2);
  expect(game.finaleIntro).toBeUndefined(); expect(game.battleComment).toBeUndefined(); expect(game.battleCommentFrames).toBe(0);
});

it('通常の掛け声は指定した7戦だけに出し、4秒後に消す', () => {
  const checks = [[1, false, true], [2, false, true], [3, false, true], [4, false, true], [5, false, true], [3, true, true], [5, true, true], [1, true, false], [2, true, false], [4, true, false]] as const;
  for (const [stage, mid, expected] of checks) {
    const game = new Game(); game.invincible = true; game.startStage(stage); game.startBoss(mid, 1);
    expect(!!game.battleComment).toBe(expected);
    if (expected) { run(game, 240); expect(game.battleCommentFrames).toBe(0); }
  }
});

it('暗転中のX連打で時間を戻さず、Zでも暗転3秒を短縮しない', () => {
  const game = new Game(); game.scene = 'credits'; game.creditsFrame = CREDITS_ROLL_FRAMES - 90;
  game.keys.add('KeyZ'); press(game, 'KeyX'); const frame = game.creditsFrame; press(game, 'KeyX');
  expect(game.creditsFrame).toBe(frame + 1); expect(game.bgm.sceneVolumeMultiplier).toBeLessThan(0.5);
});

it('最終技へ移る直前の被弾を取り消さず、被弾猶予中のボムも使える', () => {
  for (const bomb of [false, true]) {
    const game = new Game(); game.startStage(1); game.startBoss(false, 5); game.phaseHp = 0; game.pendingHit = 0; game.update();
    expect(game.finaleIntro).toBeDefined(); expect(game.pendingHit).toBe(1);
    if (bomb) press(game, 'KeyX'); else run(game, 7);
    expect(game.lives).toBe(bomb ? 2 : 1); expect(game.pendingHit).toBe(-1);
    expect(game.bombs).toBe(bomb ? 2 : 3); expect(game.phaseHp).toBe(game.phaseMaxHp);
  }
});

it('スタッフロールから戻る瞬間にエンディング曲の音量を戻さない', () => {
  const game = new Game(); game.bgm.sync('ending', false, 0.01); game.scene = 'credits'; game.creditsFrame = CREDITS_ROLL_FRAMES - 1;
  const sync = vi.spyOn(game.bgm, 'sync'); game.update();
  expect(game.scene).toBe('title'); expect(sync).toHaveBeenCalledWith('ending', false, 0, 0);
  expect(sync.mock.calls.some(call => call[0] === 'ending' && call[2] === 1)).toBe(false);
});
