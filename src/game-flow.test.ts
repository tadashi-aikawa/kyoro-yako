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

it('エンドレス・インクワイアリーの輪もボムで消え、ポーズ中には広がらない', () => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(5); game.startBoss(false, 9);
  game.phaseFrame = 104; game.update();
  const ring = game.interviewRings[0];
  expect(ring).toBeDefined();
  press(game, 'Escape'); const radius = ring.radius; const delay = ring.delay;
  for (let i = 0; i < 120; i++) game.update();
  expect(ring.radius).toBe(radius); expect(ring.delay).toBe(delay);
  press(game, 'Escape'); press(game, 'KeyX');
  expect(game.interviewRings).toHaveLength(0); expect(game.bombFrames).toBeGreaterThan(0);
});

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
  press(game, 'Escape');
  while (game.phase) game.skipPhase();
  while (game.collectionFrames > 0) game.update();
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

it.each(['defeat', 'timeout'] as const)('5面エトキチは%sで3技を順に終え、会話後にミネルヴァへ進む', (ending) => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(5); game.startBoss(true, 0);
  game.update();
  expect(game.debugState).toMatchObject({ boss: 'エトキチ', bossRole: 'midboss', bgm: 'stage-dawn' });
  for (let index = 0; index < 3; index++) {
    expect(game.remainingSpells).toBe(3 - index);
    expect(game.phaseIndex).toBe(index);
    if (ending === 'defeat') game.phaseHp = 0;
    else game.phaseFrame = game.phase!.duration * 60 - 1;
    game.update();
    expect(game.encoreCount).toBe(0);
    if (index < 2) expect(game.collectionFrames).toBe(0);
  }
  expect(game.remainingSpells).toBe(0);
  expect(game.collectionFrames).toBe(180);
  while (game.collectionFrames > 0) game.update();
  expect(game.scene).toBe('dialogue');
  expect(game.lines[0].who).toBe('etokichi');
  for (let i = 0; i < game.lines.length; i++) press(game, 'KeyZ');
  game.midbossElapsedFrames = ending === 'timeout' ? 8100 : 4000;
  game.stageFrame = ending === 'timeout' ? 2899 : 4369;
  game.update();
  expect(game.scene).toBe('transition');
  for (let frame = 0; frame < 45 + 80; frame++) game.update();
  expect(game.scene).toBe('dialogue');
  expect(game.afterDialogue).toBe('boss');
  expect(game.bgm.cue).toBe('boss-minerva');
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('5面中ボスの全技を%sで時間切れにしても、回収と会話を経て本ボス戦が始まる', (difficulty) => {
  const game = new Game(false); game.audio.volume = 0; game.invincible = true; game.difficulty = difficulty;
  game.startStage(5); game.stageFrame = 2449;
  game.update();
  expect(game.scene).toBe('arrival');
  for (let frame = 0; frame < 80; frame++) game.update();
  expect(game.scene).toBe('dialogue');
  expect(game.afterDialogue).toBe('mid');
  for (let i = 0; i < game.lines.length; i++) press(game, 'KeyZ');
  expect(game.scene).toBe('stage');
  const midbossAt = game.stageFrame;
  let elapsed = 0;
  for (let index = 0; index < 3; index++) {
    expect(game.phaseIndex).toBe(index);
    const phase = game.phase!;
    for (let frame = 0; frame < phase.duration * 60; frame++) game.update();
    elapsed += phase.duration * 60;
    expect(game.midbossElapsedFrames).toBe(elapsed);
    expect(game.stageFrame).toBe(midbossAt);
    if (index < 2) expect(game.collectionFrames).toBe(0);
  }
  expect(game.phase).toBeUndefined();
  expect(game.collectionFrames).toBe(180);
  expect(game.items.objects.some((item) => item.active && item.kind === 'small' && item.manual)).toBe(true);
  for (let frame = 0; frame < 179; frame++) game.update();
  expect(game.scene).toBe('stage');
  expect(game.collectionFrames).toBe(1);
  expect(game.stageFrame).toBe(midbossAt);
  game.update();
  expect(game.scene).toBe('dialogue');
  expect(game.afterDialogue).toBe('stage');
  expect(game.lines[0].who).toBe('etokichi');
  for (let i = 0; i < game.lines.length; i++) press(game, 'KeyZ');
  expect(game.scene).toBe('stage');
  expect(game.boss).toBeUndefined();
  expect(game.bgm.cue).toBe('stage-dawn');
  let enemiesAppeared = false;
  for (let frame = 0; frame < 900 && game.scene === 'stage'; frame++) {
    game.update();
    enemiesAppeared ||= game.enemies.count > 0;
  }
  expect(enemiesAppeared).toBe(true);
  expect(game.scene).toBe('transition');
  for (let frame = 0; frame < 45 + 80; frame++) game.update();
  expect(game.scene).toBe('dialogue');
  expect(game.afterDialogue).toBe('boss');
  expect(game.bgm.cue).toBe('boss-minerva');
  for (let i = 0; i < game.lines.length; i++) press(game, 'KeyZ');
  expect(game.debugState).toMatchObject({ scene: 'stage', boss: 'ミネルヴァ', bossRole: 'boss', phase: 0, bgm: 'boss-minerva' });
});

it('4面クリア後は5面へ進み、ラスボス後はみみこの結末へ進む', () => {
  const game = new Game(); game.audio.volume = 0;
  game.startStage(4);
  game.startBoss(false, 10);
  game.skipPhase();
  while (game.collectionFrames > 0) game.update();
  for (let i = 0; i < game.lines.length; i++) press(game, 'KeyZ');
  expect(game.scene).toBe('clear');
  expect(game.unlockedStages).toBe(5);
  press(game, 'KeyZ');
  expect(game.stage).toBe(5);
  expect(game.scene).toBe('stage');
  game.startBoss(false, 10);
  game.phaseHp = 0;
  game.update();
  expect(game.phase).toBeUndefined();
  while (game.collectionFrames > 0) game.update();
  expect(game.scene).toBe('dialogue');
  for (let i = 0; i < game.lines.length; i++) press(game, 'KeyZ');
  expect(game.scene).toBe('clear');
  press(game, 'KeyZ');
  expect(game.scene).toBe('ending');
  expect(game.endingLines).toHaveLength(6);
});

it('新しいスペルはキー弾・星輪・巻き戻し・再演を作る', () => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(1); game.startBoss(true, 0);
  game.phaseFrame = 104; game.update();
  expect(game.bullets.objects.filter((bullet) => bullet.active && bullet.kind === 'star').length).toBeGreaterThanOrEqual(10);
  game.startBoss(false, 1); game.phaseFrame = 104; game.update();
  expect(game.bullets.objects.some((bullet) => bullet.active && bullet.kind === 'keycap')).toBe(true);

  game.startStage(5); game.startBoss(false, 1); game.phaseFrame = 104; game.update();
  expect(game.bullets.count).toBeGreaterThan(100);

  game.startBoss(false, 7); game.phaseFrame = 104; game.update();
  const recalled = game.bullets.objects.find((bullet) => bullet.active && bullet.motion === 'recall');
  expect(recalled).toBeDefined();
  while (recalled!.age < recalled!.releaseAt) game.update();
  expect(recalled?.kind).toBe('star');
  expect(recalled?.motion).toBe('recall');
  while (recalled!.active) game.update();

  game.startBoss(false, 10); game.phaseFrame = 104; game.update();
  expect(game.minervaReprise?.cycle).toBe(0);
});
