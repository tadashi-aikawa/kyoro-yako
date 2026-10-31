import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { DASH_ATTACK, emitJinraiPattern, updateJinraiHazards } from './patterns/jinrai';
import { PRAYER_PERIOD } from './patterns/minerva-dawn';
import { STAGES } from './stages';
import { ULTIMATE_CUTINS, ULTIMATE_HOLD, ultimateCueFrame, ultimateDuration, ultimateTimeline } from './ultimate-cutin';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([['jinrai', 24, 216], ['claudine', 19, 171], ['minerva', 19, 171]] as const)('%sの退場は半分の%sフレームで終わり、保持時間は変えない', (boss, fadeFrames, total) => {
  const spec = ULTIMATE_CUTINS[boss], fadeStart = ultimateCueFrame(spec, 120) + ULTIMATE_HOLD;
  expect(spec.fadeFrames).toBe(fadeFrames); expect(ultimateDuration(spec)).toBe(total);
  expect(ultimateTimeline(spec, fadeStart).age).toBe(120);
  expect(ultimateTimeline(spec, fadeStart + fadeFrames - 1).battleFrame).toBeLessThan(spec.duration);
  expect(ultimateTimeline(spec, fadeStart + fadeFrames).battleFrame).toBe(spec.duration);
});

it.each([[3, 9, 120, 'claudine'], [4, 10, 150, 'jinrai'], [5, 10, 0, 'minerva']] as const)('%s面は絵と技名を72フレーム保持し、その間は攻撃とボーナスの時計を止める', (stage, phase, start, boss) => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(stage); game.startBoss(false, phase);
  while (game.phaseFrame < start) game.update();
  const spec = ULTIMATE_CUTINS[boss], begin = game.frame;
  for (let i = 0; i < ultimateCueFrame(spec, 96); i++) game.update();
  const stopped = [game.phaseFrame, game.cutin, game.spellBonus];
  const portraitFrame = game.ultimateFrame;
  const item = game.spawnItem(90, 300, 'point', false)!;
  const world = [game.px, game.py, item.x, item.y, item.vx, item.vy]; game.keys.add('ArrowRight');
  for (let i = 0; i < ULTIMATE_HOLD; i++) game.update();
  expect([game.phaseFrame, game.cutin, game.spellBonus]).toEqual(stopped);
  expect([game.px, game.py, item.x, item.y, item.vx, item.vy]).toEqual(world); game.keys.clear();
  expect(game.ultimateFrame).toBe(portraitFrame + ULTIMATE_HOLD);
  expect(game.bullets.count).toBe(0);
  game.scene = 'pause'; game.resumeScene = 'stage';
  for (let i = 0; i < 30; i++) game.update();
  expect(game.ultimateFrame).toBe(portraitFrame + ULTIMATE_HOLD); game.scene = 'stage';
  while (game.cutin > 0) game.update();
  expect(game.phaseFrame).toBe(start + spec.duration);
  expect(game.frame - begin - 30).toBe(ultimateDuration(spec));
  expect(game.ultimateFrame).toBe(-1);
  game.startStage(stage); expect(game.ultimateFrame).toBe(-1); expect(game.cutin).toBe(0);
});

it.each([[3, 9, 120, 100], [4, 10, 150, 150], [5, 10, 0, 100]] as const)('%s面の最終宣言は二拍と技名の専用SEをそれぞれ一度だけ鳴らす', (stage, phase, start, duration) => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  const events: [string, number][] = [];
  vi.spyOn(game.audio, 'play').mockImplementation(sound => { events.push([sound, game.phaseFrame]); });
  game.startStage(stage); game.startBoss(false, phase);
  while (game.phaseFrame < start) game.update();
  expect(game.cutin).toBe(duration);
  expect(game.images[`${game.boss}-ultimate`].src).toContain('/assets/cutins/');
  const bombs = game.bombs;
  game.keys.add('KeyZ');
  while (game.phaseFrame < start + duration) {
    game.update(); expect(game.shots.count).toBe(0); expect(game.bullets.count).toBe(0);
  }
  expect(game.phaseFrame).toBe(start + duration); expect(game.cutin).toBe(0); expect(game.bombs).toBe(bombs);
  expect(events.filter(([sound]) => sound === 'ultimateStamp')).toEqual([['ultimateStamp', start], ['ultimateStamp', start + 12]]);
  expect(events.filter(([sound]) => sound === 'ultimateShine')).toEqual([['ultimateShine', start + ultimateCueFrame(ULTIMATE_CUTINS[game.boss as 'jinrai' | 'claudine' | 'minerva'], 64)]]);
  expect(game.bgm.sceneVolumeMultiplier).toBe(1);
});

it.each([[3, 9, 120], [4, 10, 150], [5, 10, 0]] as const)('%s面の最終宣言は二拍・技名・保持・退場を通してBGMの音量を維持する', (stage, phase, start) => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  const sync = vi.spyOn(game.bgm, 'sync');
  game.startStage(stage); game.startBoss(false, phase);
  game.bgm.setVolume(60);
  const duration = ULTIMATE_CUTINS[game.boss as keyof typeof ULTIMATE_CUTINS].duration;
  do {
    expect(game.bgm.sceneVolumeMultiplier).toBe(1);
    expect(game.bgm.effectiveVolume).toBeCloseTo(0.6);
    game.update();
  } while (game.phaseFrame <= start + duration + 5);
  expect(sync.mock.calls.every(([, duck, multiplier]) => !duck && multiplier === 1)).toBe(true);
});

it.each([[3, 9, 120], [4, 10, 150], [5, 10, 0]] as const)('%s面の最終カットインでもポーズの減音と復帰・リトライ時の通常音量を保つ', (stage, phase, start) => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(stage); game.startBoss(false, phase);
  while (game.phaseFrame < start + 12) game.update();
  game.bgm.setVolume(60);
  const frame = game.ultimateFrame;
  game.resumeScene = 'stage'; game.scene = 'pause'; game.update();
  expect(game.ultimateFrame).toBe(frame);
  expect(game.bgm.sceneVolumeMultiplier).toBe(1);
  expect(game.bgm.effectiveVolume).toBeCloseTo(0.6 * 0.35);
  game.scene = 'stage'; game.update();
  expect(game.bgm.effectiveVolume).toBeCloseTo(0.6);
  game.startStage(stage); game.startBoss(false, phase); game.update();
  expect(game.bgm.sceneVolumeMultiplier).toBe(1);
  expect(game.bgm.effectiveVolume).toBeCloseTo(0.6);
});

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
  game.phaseFrame = 2609; game.update();
  expect(game.bullets.count).toBe(42);
  expect(play.mock.calls.filter(([sound]) => sound === 'jinraiShot')).toHaveLength(1);
  expect(play).not.toHaveBeenCalledWith('enemyShot');
});

it('花影は二度の溜めと分身の開始時だけ忍術の音を鳴らす', () => {
  const game = new Game(); game.invincible = true; game.startStage(4); game.startBoss(false, 8);
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  game.phaseFrame = 104; game.update();
  expect(play).not.toHaveBeenCalledWith('ninpo');
  for (const frame of [404, 2399]) {
    game.phaseFrame = frame; game.update(); game.update();
  }
  expect(play.mock.calls.filter(([sound]) => sound === 'prayerCharge')).toHaveLength(2);
  for (const frame of [494, 2489]) {
    game.phaseFrame = frame; game.update(); game.update();
  }
  expect(play.mock.calls.filter(([sound]) => sound === 'ninpo')).toHaveLength(2);
});

it('発射SEは予告中に鳴らず、インタビューの輪が動き始める時に鳴る', () => {
  const game = new Game(); game.invincible = true; game.startStage(5); game.startBoss(false, 9);
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

it('レーザーは予告中に鳴らさず、危険になるフレームで鳴らす', () => {
  const game = new Game(); game.invincible = true; game.startStage(4); game.startBoss(false, 3);
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  game.jinraiLasers.push({ x: 192, y: 80, age: 58, warning: 60, life: 260, angle: 1, speed: 0.003 });
  updateJinraiHazards(game);
  expect(play).not.toHaveBeenCalled();
  updateJinraiHazards(game);
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
  game.phaseFrame = DASH_ATTACK;
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

it('祈りは充填開始に低い唸りを1回鳴らし、連射と休止中には繰り返さない', () => {
  const game = new Game(); game.invincible = true; game.startStage(5); game.startBoss(false, 10);
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  game.phaseFrame = 104; game.update();
  for (let i = 0; i < 2; i++) { game.phaseHp -= game.phaseMaxHp * 0.075 + 0.000001; game.update(); }
  expect(play).not.toHaveBeenCalledWith('prayerCharge');
  game.phaseHp -= game.phaseMaxHp * 0.075 + 0.000001; game.update();
  expect(play.mock.calls.filter(([sound]) => sound === 'prayerCharge')).toHaveLength(1);
  expect(play).not.toHaveBeenCalledWith('declare');
  for (let i = 0; i < PRAYER_PERIOD - 1; i++) game.update();
  expect(play.mock.calls.filter(([sound]) => sound === 'prayerCharge')).toHaveLength(1);
  game.update();
  expect(play.mock.calls.filter(([sound]) => sound === 'prayerCharge')).toHaveLength(2);
});
