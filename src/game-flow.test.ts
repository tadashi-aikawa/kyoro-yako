import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { STAGES } from './stages';

const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void> = {};

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof listeners[string]) => { listeners[kind] = listener; } });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => vi.unstubAllGlobals());

function press(game: Game, code: string): void {
  listeners.keydown({ code, repeat: false, preventDefault: () => {} });
  game.update();
  listeners.keyup({ code, repeat: false, preventDefault: () => {} });
}

it('道中と中ボスの間も背景が進み、ポーズと会話では止まり、次の面で戻る', () => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true; game.startStage(3);
  game.update(); const roadDistance = game.sceneryDistance;
  expect(roadDistance).toBeGreaterThan(0);
  game.startBoss(true, 0); const stageFrame = game.stageFrame;
  for (let i = 0; i < 60; i++) game.update();
  expect(game.stageFrame).toBe(stageFrame);
  expect(game.sceneryDistance).toBeGreaterThan(roadDistance);
  press(game, 'Escape'); const pausedDistance = game.sceneryDistance;
  for (let i = 0; i < 60; i++) game.update();
  expect(game.sceneryDistance).toBe(pausedDistance);
  press(game, 'Escape'); game.skipPhase();
  expect(game.scene).toBe('dialogue'); const dialogueDistance = game.sceneryDistance;
  for (let i = 0; i < 60; i++) game.update();
  expect(game.sceneryDistance).toBe(dialogueDistance);
  game.startStage(2); expect(game.sceneryDistance).toBe(0);
});

it('難易度選択の次は自機選択を飛ばして1面を始める', () => {
  const game = new Game(); game.audio.volume = 0;
  press(game, 'KeyZ');
  expect(game.scene).toBe('difficulty');
  game.menu = 2;
  press(game, 'KeyZ');
  expect(game.scene).toBe('stage');
  expect(game.stage).toBe(1);
  expect(game.player).toBe('mimiko');
  expect(game.difficulty).toBe('hard');
});

it('5面までのデバッグ入口とBGM名を使い、旧自機を受け付けない', () => {
  for (let stage = 1; stage <= 5; stage++) {
    vi.stubGlobal('location', { search: `?stage=${stage}` });
    const game = new Game(); game.audio.volume = 0;
    expect(game.stage).toBe(stage);
    expect(game.scene).toBe('stage');
    expect(game.bgm.cue).toBe(STAGES[stage - 1].bgm);
  }
  vi.stubGlobal('location', { search: '?boss=5&phase=6' });
  const boss = new Game(); boss.audio.volume = 0;
  expect(boss.debugState).toMatchObject({ stage: 5, boss: 'ミネルヴァ', bossRole: 'boss', phase: 6, bgm: 'boss-minerva' });
  vi.stubGlobal('location', { search: '?player=neo' });
  const invalid = new Game(); invalid.audio.volume = 0;
  expect(invalid.scene).toBe('title');
  expect(invalid.player).toBe('mimiko');
  vi.stubGlobal('location', { search: '?ending=mimiko' });
  expect(new Game().scene).toBe('ending');
});

it('5面のネオは最大3回だけ時間を延長し、体力を削れば先に退場する', () => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(5); game.startBoss(true, 0);
  game.update();
  expect(game.debugState).toMatchObject({ boss: 'ネオ', bossRole: 'midboss', bgm: 'stage-dawn' });
  for (let extension = 1; extension <= 3; extension++) {
    game.phaseFrame = game.phase!.duration * 60 - 1;
    game.update();
    expect(game.encoreCount).toBe(extension);
    expect(game.message).toBe('最後にもう一つだけ！');
    expect(game.scene).toBe('stage');
  }
  game.phaseFrame = game.phase!.duration * 60 - 1;
  game.update();
  expect(game.scene).toBe('dialogue');
  expect(game.encoreCount).toBe(3);
  for (let i = 0; i < game.lines.length; i++) press(game, 'KeyZ');
  game.midbossElapsedFrames = 2568;
  game.stageFrame = 6000 - game.midbossElapsedFrames - 1;
  game.update();
  expect(game.scene).toBe('dialogue');
  expect(game.afterDialogue).toBe('boss');
  expect(game.bgm.cue).toBe('boss-minerva');

  const early = new Game(); early.audio.volume = 0;
  early.startStage(5); early.startBoss(true, 0);
  early.phaseHp = 0;
  early.update();
  expect(early.scene).toBe('dialogue');
  expect(early.encoreCount).toBe(0);
});

it('4面クリア後は5面へ進み、ラスボス後はみみこの結末へ進む', () => {
  const game = new Game(); game.audio.volume = 0;
  game.startStage(4);
  game.startBoss(false, 9);
  game.skipPhase();
  for (let i = 0; i < game.lines.length; i++) press(game, 'KeyZ');
  expect(game.scene).toBe('clear');
  expect(game.unlockedStages).toBe(5);
  press(game, 'KeyZ');
  expect(game.stage).toBe(5);
  expect(game.scene).toBe('stage');
  game.startBoss(false, 12);
  game.phaseHp = 0;
  game.update();
  expect(game.phase?.pattern).toBe('owlDawn');
  game.skipPhase();
  expect(game.scene).toBe('dialogue');
  for (let i = 0; i < game.lines.length; i++) press(game, 'KeyZ');
  expect(game.scene).toBe('clear');
  press(game, 'KeyZ');
  expect(game.scene).toBe('ending');
  expect(game.endingLines).toHaveLength(6);
});

it('新しいスペルはキー弾・星輪・疑問符・巻き戻し・羽ばたきを作る', () => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(1); game.startBoss(true, 0);
  game.phaseFrame = 104; game.update();
  expect(game.bullets.objects.filter((bullet) => bullet.active && bullet.kind === 'star').length).toBeGreaterThanOrEqual(10);
  game.startBoss(false, 1); game.phaseFrame = 104; game.update();
  expect(game.bullets.objects.some((bullet) => bullet.active && bullet.kind === 'keycap')).toBe(true);

  game.startStage(5); game.startBoss(false, 1); game.phaseFrame = 104; game.update();
  expect(game.bullets.count).toBeGreaterThan(100);
  game.startBoss(false, 3); game.phaseFrame = 104; game.update();
  const question = game.bullets.objects.find((bullet) => bullet.active && bullet.motion === 'question');
  expect(question).toBeDefined();
  for (let i = 0; i < 40; i++) game.update();
  expect(question?.vx).toBe(0);
  for (let i = 0; i < 35; i++) game.update();
  expect(question?.motion).toBe('normal');

  game.startBoss(false, 9); game.phaseFrame = 104; game.update();
  const recalled = game.bullets.objects.find((bullet) => bullet.active && bullet.motion === 'recall');
  expect(recalled).toBeDefined();
  for (let i = 0; i < 104; i++) game.update();
  expect(recalled?.kind).toBe('star');
  expect(recalled?.motion).toBe('normal');

  game.startBoss(false, 12); game.phaseFrame = 104; game.update();
  expect(game.bullets.objects.filter((bullet) => bullet.active && bullet.motion === 'wing').length).toBeGreaterThan(20);
});
