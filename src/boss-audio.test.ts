import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { emitJinraiPattern, updateJinraiHazards } from './patterns/jinrai';
import { STAGES } from './stages';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('発射SEは斉射の弾数によらず1フレーム1回で、道中には混ざらない', () => {
  const game = new Game();
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  game.startStage(3);
  game.spawnBullet(192, 80, 0, 1, 0);
  expect(play).not.toHaveBeenCalled();
  game.startBoss(false, 0);
  for (let i = 0; i < 100; i++) game.spawnBullet(192, 80, 0, 1, 0);
  game.update();
  expect(play.mock.calls.filter(([sound]) => sound === 'enemyShot')).toHaveLength(1);
});

it('迅雷の通常攻撃は短い専用SEを斉射ごとに1回鳴らし、汎用SEと重ねない', () => {
  const game = new Game(); game.invincible = true; game.startStage(4); game.startBoss(false, 0);
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  game.phaseFrame = 104; game.update();
  expect(game.bullets.count).toBeGreaterThan(1);
  expect(play.mock.calls.filter(([sound]) => sound === 'jinraiShot')).toHaveLength(1);
  expect(play).not.toHaveBeenCalledWith('enemyShot');
});

it('花影の三身同時射撃は通常攻撃と同じ専用SEを1回だけ鳴らす', () => {
  const game = new Game(); game.invincible = true; game.startStage(4); game.startBoss(false, 8);
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  game.phaseFrame = 2009; game.update();
  expect(game.bullets.count).toBe(42);
  expect(play.mock.calls.filter(([sound]) => sound === 'jinraiShot')).toHaveLength(1);
  expect(play).not.toHaveBeenCalledWith('enemyShot');
});

it('花影は二度の溜めと分身の開始時だけ忍術の音を鳴らす', () => {
  const game = new Game(); game.invincible = true; game.startStage(4); game.startBoss(false, 8);
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  game.phaseFrame = 104; game.update();
  expect(play).not.toHaveBeenCalledWith('ninpo');
  for (const frame of [404, 1799]) {
    game.phaseFrame = frame; game.update(); game.update();
  }
  expect(play.mock.calls.filter(([sound]) => sound === 'prayerCharge')).toHaveLength(2);
  for (const frame of [494, 1889]) {
    game.phaseFrame = frame; game.update(); game.update();
  }
  expect(play.mock.calls.filter(([sound]) => sound === 'ninpo')).toHaveLength(2);
});

it('発射SEは予告中に鳴らず、インタビューの輪が動き始める時に鳴る', () => {
  const game = new Game(); game.invincible = true; game.startStage(5); game.startBoss(false, 11);
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  game.phaseFrame = 104; game.update();
  const ring = game.interviewRings[0];
  expect(play).not.toHaveBeenCalledWith('enemyShot');
  const start = ring.radius;
  for (let i = 0; i < 69; i++) game.update();
  expect(play).not.toHaveBeenCalledWith('enemyShot');
  game.update();
  expect(play.mock.calls.filter(([sound]) => sound === 'enemyShot')).toHaveLength(1);
  expect(ring.radius).toBeGreaterThan(start);
});

it('レーザーと雷は予告中に鳴らさず、危険になるフレームで鳴らす', () => {
  const game = new Game(); game.invincible = true; game.startStage(4); game.startBoss(false, 3);
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  game.jinraiLasers.push({ x: 192, y: 80, age: 58, warning: 60, life: 260, angle: 1, speed: 0.003 });
  game.jinraiMarks.push({ x: 192, y: 300, age: 58, warning: 60 });
  updateJinraiHazards(game);
  expect(play).not.toHaveBeenCalled();
  updateJinraiHazards(game);
  expect(play).toHaveBeenCalledWith('thunder');
  expect(play).not.toHaveBeenCalledWith('laser');
  updateJinraiHazards(game);
  expect(play).toHaveBeenCalledWith('laser');
});

it('格子は行数によらず一斉移動のSEを1回だけ鳴らす', () => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    const game = new Game(); game.invincible = true; game.difficulty = difficulty;
    game.startStage(3); game.startBoss(false, 5);
    const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
    game.phaseFrame = 104; game.update();
    const grid = game.bullets.objects.filter((b) => b.active && b.motion === 'layoutGrid');
    expect(new Set(grid.map((b) => b.gridRow)).size).toBeGreaterThan(3);
    const warning = grid[0].releaseAt;
    for (let i = 1; i < warning - 1; i++) game.update();
    expect(play).not.toHaveBeenCalledWith('laser');
    game.update();
    expect(play.mock.calls.filter(([sound]) => sound === 'laser')).toHaveLength(1);
    expect(grid.every((b) => b.motion === 'normal')).toBe(true);
  }
});

it('一閃と夜桜の突風が発動に同期する', () => {
  const game = new Game(); game.startStage(4); game.startBoss(false, 10);
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  game.jinraiDashTick = 61;
  emitJinraiPattern(game, 'jinraiDash', 0);
  expect(play).toHaveBeenCalledWith('slash');
  play.mockClear();
  emitJinraiPattern(game, 'jinraiSakura', 359);
  expect(play).not.toHaveBeenCalledWith('wind');
  emitJinraiPattern(game, 'jinraiSakura', 360);
  expect(play).toHaveBeenCalledWith('wind');
});

it('カットインは攻撃開始前に消え、入れ替えたボスに技が割り当たる', () => {
  expect(STAGES.map((s) => s.boss)).toEqual(['neo', 'obsidia', 'claudine', 'jinrai', 'minerva']);
  for (const stage of [3, 4, 5]) {
    const game = new Game(); game.audio.volume = 0; game.invincible = true;
    game.startStage(stage); game.startBoss(false, 1);
    for (let i = 0; i < 100; i++) game.update();
    expect(game.cutin).toBe(0);
    expect(game.bullets.count).toBe(0);
    // 宵の誘いはカットイン後にも、手元にハートを灯す18フレームの予告が入る。
    for (let i = 0; i < 5 + (stage === 4 ? 18 : 0); i++) game.update();
    expect(game.bullets.count, `stage ${stage}`).toBeGreaterThan(0);
  }
});

it('最後の祈りは充填開始に低い唸りを1回鳴らし、連射と休止中には繰り返さない', () => {
  const game = new Game(); game.invincible = true; game.startStage(5); game.startBoss(false, 12);
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  game.phaseFrame = 1798; game.update();
  expect(play).not.toHaveBeenCalledWith('prayerCharge');
  game.update();
  expect(play.mock.calls.filter(([sound]) => sound === 'prayerCharge')).toHaveLength(1);
  expect(play).not.toHaveBeenCalledWith('declare');
  for (let i = 0; i < 359; i++) game.update();
  expect(play.mock.calls.filter(([sound]) => sound === 'prayerCharge')).toHaveLength(1);
  game.update();
  expect(play.mock.calls.filter(([sound]) => sound === 'prayerCharge')).toHaveLength(2);
});
