import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game, type Item } from './game';
import { midPhases, STAGES } from './stages';

const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void> = {};
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof listeners[string]) => { listeners[kind] = listener; } });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function start(stage = 1, phase = 0, mid = false): Game {
  const game = new Game();
  game.audio.volume = 0;
  game.startStage(stage);
  game.startBoss(mid, phase);
  return game;
}
function run(game: Game, frames: number): void { for (let i = 0; i < frames; i++) game.update(); }
function supplies(game: Game): Item[] { return game.items.objects.filter((item) => item.active && item.manual); }
function hit(game: Game, power: number): void { game.power = power; game.pendingHit = 7; game.update(); }

it('被弾で失った1.00を20個の小Pに分け、画面へ広く分散する', () => {
  const game = start();
  game.bombs = 6;
  hit(game, 4);
  const drops = supplies(game);
  expect(game.power).toBe(3);
  expect(game.bombs).toBe(6);
  expect(game.lives).toBe(1);
  expect(drops).toHaveLength(20);
  expect(drops.every((item) => item.kind === 'small' && !item.auto)).toBe(true);
  expect(Math.max(...drops.map((i) => i.x)) - Math.min(...drops.map((i) => i.x))).toBeGreaterThan(250);
  expect(Math.max(...drops.map((i) => i.y)) - Math.min(...drops.map((i) => i.y))).toBeGreaterThan(150);
  run(game, 170);
  expect(game.power).toBeLessThan(4);
});

it.each([0, 0.05, 0.35, 0.95])('Power %sでの被弾は失った量を超えるPを出さない', (power) => {
  const game = start();
  game.bombs = 0;
  hit(game, power);
  expect(game.power).toBe(0);
  expect(game.bombs).toBe(3);
  expect(supplies(game)).toHaveLength(Math.round(power / 0.05));
});

it('上部へ移動しても散ったPは一括回収されず、近づいた分だけ回収する', () => {
  const game = start();
  hit(game, 4);
  game.py = 15;
  game.keys.add('ShiftLeft');
  run(game, 60);
  expect(game.power).toBeLessThan(4);
  const target = supplies(game).find((item) => item.y > 150)!;
  const before = game.power;
  game.px = target.x;
  game.py = target.y;
  game.update();
  expect(game.power).toBeGreaterThan(before);
});

it('喰らいボムではPowerを失わず、被弾時の回収品も出ない', () => {
  const game = start();
  game.power = 4;
  game.pendingHit = 7;
  listeners.keydown({ code: 'KeyX', repeat: false, preventDefault: () => {} });
  game.update();
  expect(game.power).toBe(4);
  expect(game.lives).toBe(2);
  expect(game.bombs).toBe(2);
  expect(supplies(game)).toHaveLength(0);
});

it('補充は小P10個を広く散布し、抽選されたボムも手で拾う', () => {
  const game = start(1, 1);
  game.bombs = 0;
  vi.mocked(Math.random).mockReturnValueOnce(0.1);
  game.phaseHp = 0;
  game.update();
  const drops = supplies(game);
  expect(drops.filter((item) => item.kind === 'small')).toHaveLength(10);
  const bomb = drops.find((item) => item.kind === 'bomb')!;
  expect(bomb).toBeDefined();
  expect(drops.every((item) => !item.auto)).toBe(true);
  expect(Math.max(...drops.map((i) => i.x)) - Math.min(...drops.map((i) => i.x))).toBeGreaterThan(250);
  run(game, 104);
  expect(game.power).toBe(0);
  expect(game.bombs).toBe(0);
  game.px = bomb.x; game.py = bomb.y;
  game.update();
  expect(game.bombs).toBe(1);
});

it.each([0.05, 0.5, 0.95])('補充位置は乱数%sで変わり、フィールド内に留まる', (random) => {
  vi.mocked(Math.random).mockReturnValue(random);
  const game = start(1, 1);
  vi.mocked(Math.random).mockReturnValueOnce(0.5);
  game.skipPhase();
  const drops = supplies(game);
  expect(drops[0].x).toBeCloseTo(24 + ((0.2 + random * 0.6) / 5) * 336);
  game.px = 12; game.py = 439;
  run(game, 104);
  expect(supplies(game).every((item) => item.x >= 12 && item.x <= 372)).toBe(true);
});

it('時間切れでも手動回収の補充品を出す', () => {
  const game = start(1, 1);
  game.bombs = 0;
  game.phaseFrame = game.phase!.duration * 60 - 1;
  game.update();
  expect(game.phaseIndex).toBe(2);
  expect(supplies(game)).toHaveLength(10);
  expect(supplies(game).every((item) => item.kind === 'small')).toBe(true);
  expect(game.power).toBe(0);
  expect(game.bombs).toBe(0);
});

it('弾消しで点アイテムがプールを埋めても補充品を優先する', () => {
  const game = start(1, 1);
  vi.mocked(Math.random).mockReturnValueOnce(0.1);
  for (let i = 0; i < 2600; i++) game.spawnBullet(192, 120, 0, 0, 0, 'orb');
  game.phaseHp = 0;
  game.update();
  expect(supplies(game).filter((item) => item.kind === 'small')).toHaveLength(10);
  expect(supplies(game).some((item) => item.kind === 'bomb')).toBe(true);
});

it('全中ボスの戦闘最後に回収時間を設け、拾わなければ補充しない', () => {
  for (let stage = 1; stage <= STAGES.length; stage++) {
    const game = start(stage, midPhases(STAGES[stage - 1].mid, stage).length - 1, true);
    game.bombs = 0;
    game.power = 3;
    game.px = 12; game.py = 439;
    game.skipPhase();
    expect(game.phase).toBeUndefined();
    expect(game.scene).toBe('stage');
    expect(game.collectionFrames).toBe(180);
    const stageFrame = game.stageFrame;
    run(game, 179);
    expect(game.scene).toBe('stage');
    expect(game.stageFrame).toBe(stageFrame);
    game.update();
    expect(game.collectionFrames).toBe(0);
    expect(game.power).toBe(3);
    expect(game.bombs).toBe(0);
    expect(game.scene).toBe(stage !== 3 && stage !== 5 ? 'stage' : 'dialogue');
  }
});

it('回収時間中は移動でき、ポーズで時計が止まり、再開後に回収して会話へ進む', () => {
  const game = start(3, midPhases('chappy').length - 1, true);
  game.bombs = 0;
  vi.mocked(Math.random).mockReturnValueOnce(0.1);
  game.skipPhase();
  listeners.keydown({ code: 'Escape', repeat: false, preventDefault: () => {} });
  game.update();
  expect(game.scene).toBe('pause');
  run(game, 30);
  expect(game.collectionFrames).toBe(180);
  game.keys.delete('Escape');
  listeners.keydown({ code: 'Escape', repeat: false, preventDefault: () => {} });
  game.update();
  game.keys.delete('Escape');
  for (const target of supplies(game)) {
    game.px = target.x; game.py = target.y; game.update();
  }
  expect(game.power).toBe(0.5);
  expect(game.bombs).toBe(1);
  run(game, game.collectionFrames);
  expect(game.scene).toBe('dialogue');
  game.startStage(4);
  expect(game.collectionFrames).toBe(0);
});

it('本ボスの白演出中もボスBGMを35%で維持し、対峙から通常音量へ戻す', () => {
  const game = start(4, STAGES[3].phases.length - 1);
  game.update();
  expect(game.bgm.cue).toBe('boss-jinrai');
  game.skipPhase();
  game.update();
  expect(game.bgm.cue).toBe('boss-jinrai');
  run(game, 8 + 90 + 149);
  expect(game.scene).toBe('transition');
  expect(game.bgm.cue).toBe('boss-jinrai');
  expect(game.bgm.sceneVolumeMultiplier).toBe(0.35);
  run(game, 60 + 120);
  expect(game.scene).toBe('dialogue');
  expect(game.bgm.sceneVolumeMultiplier).toBe(1);
  expect(game.bgm.cue).toBe('boss-jinrai');
});

it('5面エトキチは各技の時間切れで補充し、3技目だけ回収待ちへ進む', () => {
  const game = start(5, 0, true);
  game.invincible = true;
  for (let i = 0; i < 3; i++) {
    game.items.clear();
    game.phaseFrame = game.phase!.duration * 60 - 1;
    game.update();
    expect(supplies(game)).toHaveLength(10);
    expect(game.collectionFrames).toBe(i === 2 ? 180 : 0);
  }
});

it('拾ってもPower5・ボム8を超えず、被弾でもボム備蓄を失わない', () => {
  const game = start(3, 0, true);
  game.power = 5; game.bombs = 8;
  vi.mocked(Math.random).mockReturnValueOnce(0.1);
  game.skipPhase();
  for (const target of supplies(game)) { game.px = target.x; game.py = target.y; game.update(); }
  expect(game.power).toBe(5); expect(game.bombs).toBe(8);
  game.startBoss(false, 1);
  hit(game, 4);
  expect(game.bombs).toBe(8);
});

it.each([
  [0, 'life'], [0.019999, 'life'], [0.02, 'bomb'],
  [0.319999, 'bomb'], [0.32, undefined], [0.999999, undefined],
] as const)('追加品の抽選値%sは%sを出し、小P10個は維持する', (roll, bonus) => {
  const game = start();
  vi.mocked(Math.random).mockReturnValueOnce(roll);
  game.skipPhase();
  const drops = supplies(game);
  expect(drops.filter((item) => item.kind === 'small')).toHaveLength(10);
  expect(drops.filter((item) => item.kind !== 'small').map((item) => item.kind)).toEqual(bonus ? [bonus] : []);
});

it('抽選されたライフは拾ったときだけ残機が増える', () => {
  const game = start();
  vi.mocked(Math.random).mockReturnValueOnce(0.01);
  game.skipPhase();
  expect(game.lives).toBe(2);
  const life = supplies(game).find((item) => item.kind === 'life')!;
  game.px = life.x; game.py = life.y; game.update();
  expect(game.lives).toBe(3);
});

it.each([4, 5])('%s面の本ボスは小P20個を出し、追加品の確率も倍増する', (stage) => {
  for (const [roll, bonus] of [
    [0, 'life'], [0.039999, 'life'], [0.04, 'bomb'],
    [0.639999, 'bomb'], [0.64, undefined], [0.999999, undefined],
  ] as const) {
    const game = start(stage);
    vi.mocked(Math.random).mockReturnValueOnce(roll);
    game.skipPhase();
    const drops = supplies(game);
    expect(drops.filter((item) => item.kind === 'small')).toHaveLength(20);
    expect(drops.filter((item) => item.kind !== 'small').map((item) => item.kind)).toEqual(bonus ? [bonus] : []);
    expect(drops.every((item) => item.manual && !item.auto)).toBe(true);
  }
});

it.each([1, 2, 3, 4, 5])('%s面の中ボスは従来の補充量と確率を保つ', (stage) => {
  const game = start(stage, 0, true);
  vi.mocked(Math.random).mockReturnValueOnce(0.5);
  game.skipPhase();
  expect(supplies(game)).toHaveLength(10);
  expect(supplies(game).every((item) => item.kind === 'small')).toBe(true);
});
