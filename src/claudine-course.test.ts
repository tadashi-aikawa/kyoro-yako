import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { COURSE_LAP, courseCenter, courseCenterAt, courseContact } from './patterns/claudine-course';
import { FIELD } from './rules';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => vi.unstubAllGlobals());

function start(difficulty: Game['difficulty']): Game {
  const game = new Game(); game.audio.volume = 0; game.difficulty = difficulty;
  game.startStage(3); game.startBoss(false, 1); game.phaseFrame = 104;
  game.px = 192; game.py = 375; game.invulnFrames = 0;
  return game;
}

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sで低速キーだけでS字とヘアピンを2周追い、被弾せずに通れる', difficulty => {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const game = start(difficulty);
  const lives = game.lives;
  let minX = 192, maxX = 192, maxBullets = 0;
  const stationaryHits = new Set<number>();
  for (let t = 0; t < COURSE_LAP * 2 + 200; t++) {
    const target = courseCenterAt(t, game.py, level);
    game.keys.clear(); game.keys.add('ShiftLeft');
    if (Math.abs(target - game.px) > 0.825) game.keys.add(target < game.px ? 'ArrowLeft' : 'ArrowRight');
    game.update();
    minX = Math.min(minX, game.px); maxX = Math.max(maxX, game.px);
    maxBullets = Math.max(maxBullets, game.bullets.count);
    for (const x of [9, 108, 192, 276, 375]) {
      if (courseContact(t, x, FIELD.h - 9, level)) stationaryHits.add(x);
    }
    expect(game.pendingHit, `frame ${t}`).toBe(-1);
    expect(game.lives, `frame ${t}`).toBe(lives);
  }
  expect(maxX - minX).toBeGreaterThan(160);
  expect(maxBullets).toBe(0);
  expect([...stationaryHits].sort((a, b) => a - b)).toEqual([9, 108, 192, 276, 375]);
  expect(game.phaseIndex).toBe(1);
});

it('コースを曲がりながら撃ってボスへダメージを与えられる', () => {
  const game = start('normal');
  const hp = game.phaseHp;
  for (let t = 0; t < 850; t++) {
    const target = courseCenterAt(t, game.py, 1);
    game.keys.clear(); game.keys.add('ShiftLeft'); game.keys.add('KeyZ');
    if (Math.abs(target - game.px) > 0.825) game.keys.add(target < game.px ? 'ArrowLeft' : 'ArrowRight');
    game.update();
    expect(game.pendingHit).toBe(-1);
  }
  expect(game.phaseHp).toBeLessThan(hp);
});

it('中央の直線から左右へ大きく折り返し、周回の境目も中央へつながる', () => {
  expect([0, 140, 300, 480, 530, 710, 760, 940, 1440, 1740].map(courseCenter))
    .toEqual([192, 192, 270, 108, 108, 276, 276, 108, 192, 270]);
});

it.each(['invincible', 'invulnFrames', 'bombFrames'] as const)('%sの保護中は壁に入っても被弾しない', protection => {
  const game = start('normal'); game.phaseFrame = 600; game.px = 9;
  if (protection === 'invincible') game.invincible = true;
  else game[protection] = 150;
  for (let t = 0; t < 30; t++) game.update();
  expect(game.pendingHit).toBe(-1);
});

it('フェーズを抜けると壁の判定も残らない', () => {
  const game = start('normal'); game.phaseFrame = 600; game.px = 9;
  const lives = game.lives;
  game.skipPhase();
  game.py = 12;
  for (let t = 0; t < 900 && game.phaseIntro; t++) game.update();
  expect(game.phaseIntro).toBeUndefined();
  for (let t = 0; t < 150; t++) game.update();
  expect(game.phaseIndex).toBe(2);
  expect(game.phaseFrame).toBeGreaterThan(105);
  expect(courseContact(game.phaseFrame - 105, game.px, game.py, 1)).toBe(true);
  expect(game.pendingHit).toBe(-1);
  expect(game.lives).toBe(lives);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sでPower 3の低速射撃を続け、カーブを曲がりながら40秒以内に撃破できる', difficulty => {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const game = start(difficulty); game.power = 3;
  const lives = game.lives;
  for (let t = 0; t < 2400 && game.phaseIndex === 1; t++) {
    const target = courseCenterAt(t, game.py, level);
    game.keys.clear(); game.keys.add('ShiftLeft'); game.keys.add('KeyZ');
    if (Math.abs(target - game.px) > 0.825) game.keys.add(target < game.px ? 'ArrowLeft' : 'ArrowRight');
    game.update();
    expect(game.pendingHit, `frame ${t}`).toBe(-1);
  }
  expect(game.phaseIndex).toBe(2);
  expect(game.lives).toBe(lives);
});
