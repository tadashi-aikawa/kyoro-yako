import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { STAGES } from './stages';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; });
});
afterEach(() => vi.unstubAllGlobals());

function start(query: string): Game {
  vi.stubGlobal('location', { search: query });
  const game = new Game(); game.audio.volume = 0;
  game.keys.add('ControlLeft');
  for (let frame = 0; frame < 1000 && !game.phase; frame++) game.update();
  game.keys.clear();
  expect(game.phase).toBeDefined();
  return game;
}

const ratios = [
  ['', 1], ['&hp=0.05', 0.05], ['&hp=0', 0.01], ['&hp=-2', 0.01],
  ['&hp=2', 1], ['&hp=1', 1], ['&hp=invalid', 1], ['&hp=Infinity', 1],
] as const;

for (const query of ['?boss=1&phase=1', '?stage=1&from=boss']) {
  it.each(ratios)(`${query}%sの開始HP割合は%sで、次のフェーズは満タン`, (hp, expected) => {
    const game = start(query + hp);
    expect(game.debugState.phaseHpRatio).toBeCloseTo(expected);
    expect(game.phaseMaxHp).toBe(game.phase!.hp);
    game.skipPhase();
    expect(game.debugState.phaseHpRatio).toBe(1);
  });
}

it.each([1, 2, 3, 4, 5])('%s面の登場演出と会話の後にも指定HP割合を適用する', stage => {
  const game = start(`?stage=${stage}&from=boss&hp=0.05&invincible=1`);
  expect(game.midboss).toBe(false);
  expect(game.phaseIndex).toBe(0);
  expect(game.phaseMaxHp).toBe(STAGES[stage - 1].phases[0].hp);
  expect(game.debugState.phaseHpRatio).toBeCloseTo(0.05);
  game.skipPhase();
  expect(game.debugState.phaseHpRatio).toBe(1);
});

it('ミネルヴァ最終技は指定HPでも借りる最初の技の難易度を変えず、HP境界で終盤へ進む', () => {
  const game = start('?boss=5&phase=10&hp=0.05&invincible=1');
  expect(game.phaseFrame).toBe(0);
  expect(game.debugState.phaseHpRatio).toBeCloseTo(0.05);
  while (game.phaseFrame < 105) game.update();
  expect(game.minervaReprise).toMatchObject({ cycle: 0, difficulty: 'normal' });
  expect(game.debugState.phaseHpRatio).toBeCloseTo(0.05);
  for (let i = 0; i < 12; i++) game.update();
  expect(game.minervaReprise).toMatchObject({ cycle: 9, finale: { stage: 'silence' } });
  for (let frame = 0; game.minervaReprise?.cycle !== 12 && frame < 2400; frame++) game.update();
  expect(game.minervaReprise).toMatchObject({ cycle: 12, prayer: true, difficulty: 'lunatic' });
});

it('道中からの開始にはHP指定を適用しない', () => {
  vi.stubGlobal('location', { search: '?stage=1&hp=0.05' });
  const game = new Game(); game.audio.volume = 0;
  game.startBoss(false, 0);
  expect(game.debugState.phaseHpRatio).toBe(1);
});

it('本ボス到着前にステージを再開すると保留したHP指定を破棄する', () => {
  vi.stubGlobal('location', { search: '?stage=1&from=boss&hp=0.05' });
  const game = new Game(); game.audio.volume = 0;
  game.startStage(1); game.startBoss(false, 0);
  expect(game.debugState.phaseHpRatio).toBe(1);
});
