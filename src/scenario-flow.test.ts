import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BATTLE_COMMENTS, dialogue, FINAL_COMMENTS } from './dialogue';
import { CREDITS_ROLL_FRAMES } from './ending';
import { BATTLE_COMMENT_DELAY_FRAMES, BATTLE_COMMENT_FRAMES, Game, PHASE_MOVE_FRAMES } from './game';
import { DASH_CUTIN } from './patterns/jinrai';
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

it.each([1, 2, 3, 4, 5])('%s階は前の技を終えてから吹き出しを読み、既存カットインと次の技へ進む', stage => {
  const game = new Game(); game.startStage(stage); game.startBoss(false, STAGES[stage - 1].phases.length - 2);
  game.phaseHp = 0; game.update();
  expect(game.phaseIntro?.frame).toBe(0); expect(game.cutin).toBe(0); expect(game.phaseFrame).toBe(0);
  game.keys.add('KeyZ'); run(game, PHASE_MOVE_FRAMES); expect(game.shots.count).toBe(0);
  expect(game.bossXY).toEqual(stage === 2 ? [192, 150] : [192, 132]);
  run(game, 59 - PHASE_MOVE_FRAMES);
  expect(game.battleComment).toBeUndefined(); expect(game.phaseFrame).toBe(0); expect(game.cutin).toBe(0);
  game.update();
  expect(game.battleComment?.text).toBe(FINAL_COMMENTS[game.boss!]);
  expect(game.phaseIntro).toBeDefined(); expect(game.phaseFrame).toBe(0);
  expect(game.battleCommentFrames).toBe(BATTLE_COMMENT_FRAMES);
  run(game, BATTLE_COMMENT_FRAMES - 1);
  expect(game.battleCommentFrames).toBe(1); expect(game.phaseFrame).toBe(0); expect(game.cutin).toBe(0);
  expect(game.shots.count).toBe(0); expect(game.bullets.count).toBe(0); expect(game.jinraiLasers).toHaveLength(0);
  expect(game.phaseHp).toBe(game.phaseMaxHp);
  game.keys.delete('KeyZ'); game.update();
  expect(game.phaseIntro).toBeUndefined(); expect(game.battleComment).toBeUndefined(); expect(game.phaseFrame).toBe(0);
  expect(game.cutin).toBe(stage === 4 ? 0 : 100);
  if (stage === 4) { run(game, DASH_CUTIN); expect(game.cutin).toBe(100); }
  else { run(game, 105); expect(game.phaseFrame).toBe(105); expect(game.cutin).toBe(0); }
});

it('最終技前のリトライで演出とコメントを持ち越さない', () => {
  const game = new Game(); game.startStage(1); game.startBoss(false, 5); game.skipPhase(); run(game, 70);
  expect(game.battleComment).toBeDefined(); game.startStage(2);
  expect(game.phaseIntro).toBeUndefined(); expect(game.battleComment).toBeUndefined(); expect(game.battleCommentFrames).toBe(0);
});

it('通常の掛け声は指定した7戦の技の間だけに出す', () => {
  const checks = [[1, false, true], [2, false, true], [3, false, true], [4, false, true], [5, false, true], [3, true, true], [5, true, true], [1, true, false], [2, true, false], [4, true, false]] as const;
  for (const [stage, mid, expected] of checks) {
    const game = new Game(); game.invincible = true; game.startStage(stage); game.startBoss(mid, 0); game.skipPhase();
    expect(!!game.phaseIntro).toBe(expected);
    if (expected) {
      run(game, BATTLE_COMMENT_DELAY_FRAMES); expect(game.battleComment?.text).toBe(BATTLE_COMMENTS[game.boss!]);
      run(game, BATTLE_COMMENT_FRAMES - 1); expect(game.phaseFrame).toBe(0); expect(game.cutin).toBe(0); expect(game.bullets.count).toBe(0);
      game.update(); expect(game.battleComment).toBeUndefined(); expect(game.cutin).toBe(100);
    }
  }
});

it('吹き出し中のポーズでは次の技と読む時間を進めない', () => {
  const game = new Game(); game.startStage(1); game.startBoss(false, 0); game.skipPhase(); run(game, BATTLE_COMMENT_DELAY_FRAMES + 20);
  const frame = game.phaseIntro!.frame, remaining = game.battleCommentFrames;
  press(game, 'Escape'); run(game, 100);
  expect(game.phaseIntro!.frame).toBe(frame); expect(game.battleCommentFrames).toBe(remaining); expect(game.phaseFrame).toBe(0);
  press(game, 'Escape'); game.update(); expect(game.phaseIntro!.frame).toBe(frame + 1);
});

it('技の直行と演出を省いたシミュレーションは吹き出しの待機を挟まない', () => {
  const direct = new Game(); direct.startStage(1); direct.startBoss(false, 1); expect(direct.phaseIntro).toBeUndefined();
  const simulation = new Game(false); simulation.startStage(1); simulation.startBoss(false, 0); simulation.skipPhase();
  expect(simulation.phaseIntro).toBeUndefined(); expect(simulation.battleComment).toBeUndefined();
});

it('暗転中のX連打で時間を戻さず、Zでも暗転3秒を短縮しない', () => {
  const game = new Game(); game.scene = 'credits'; game.creditsFrame = CREDITS_ROLL_FRAMES - 90;
  game.keys.add('KeyZ'); press(game, 'KeyX'); const frame = game.creditsFrame; press(game, 'KeyX');
  expect(game.creditsFrame).toBe(frame + 1); expect(game.bgm.sceneVolumeMultiplier).toBeLessThan(0.5);
});

it('最終技へ移る直前の被弾を取り消さず、被弾猶予中のボムも使える', () => {
  for (const bomb of [false, true]) {
    const game = new Game(); game.startStage(1); game.startBoss(false, 5); game.phaseHp = 0; game.pendingHit = 0; game.update();
    expect(game.phaseIntro).toBeDefined(); expect(game.pendingHit).toBe(1);
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
