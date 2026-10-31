import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { GALAXY_FIRE } from './patterns/etokichi';
import { enterScene, KEY_ROWS, KEY_WORDS, keyPosition, VIM_PREPARE } from './patterns/neo';
import { bulletContact } from './rules';
import { ETOKICHI_FLASH, midPhases } from './stages';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function start(phase: number, mid = false, difficulty: Game['difficulty'] = 'normal'): Game {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.difficulty = difficulty; game.startStage(1); game.startBoss(mid, phase);
  return game;
}
const run = (game: Game, frames: number) => { for (let i = 0; i < frames; i++) game.update(); };
const active = (game: Game) => game.bullets.objects.filter((b) => b.active);

it.each(['defeat', 'timeout'] as const)('エトキチは%s後にフラッシュへ進み、2枚目の後だけ回収待ちへ入る', (ending) => {
  const game = start(0, true);
  expect(game.remainingSpells).toBe(2);
  if (ending === 'defeat') game.phaseHp = 0;
  else game.phaseFrame = game.phase!.duration * 60 - 1;
  game.update();
  expect(game.phase).toBe(ETOKICHI_FLASH);
  expect(game.phaseIndex).toBe(1); expect(game.remainingSpells).toBe(1);
  expect(game.collectionFrames).toBe(0);
  expect(game.items.objects.filter((item) => item.active && item.manual && item.kind === 'small')).toHaveLength(10);
  game.skipPhase();
  expect(game.phase).toBeUndefined(); expect(game.galaxyFlash).toBeUndefined();
  expect(game.remainingSpells).toBe(0); expect(game.collectionFrames).toBe(180);
  run(game, 180); expect(game.boss).toBeUndefined(); expect(game.scene).toBe('stage');
  expect(midPhases('neo')).toHaveLength(1);
});

it('URLからフラッシュを直接始められる', () => {
  vi.stubGlobal('location', { search: '?boss=1&mid=1&phase=1' });
  const game = new Game(); expect(game.midboss).toBe(true); expect(game.phase).toBe(ETOKICHI_FLASH);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('フラッシュは%sでも予告帯を固定し、予告中は無害、発射中は帯内だけ被弾する', (difficulty) => {
  const game = start(1, true, difficulty); game.invincible = false; game.invulnFrames = 0;
  game.phaseFrame = 104; game.update();
  const beam = game.galaxyFlash!; const angle = beam.angle;
  for (let i = 1; i < beam.warning; i++) game.update();
  expect(game.pendingHit).toBe(-1); expect(game.lives).toBe(2);
  // 元の照準点から外れても光線は追ってこない。
  game.px = 320; game.update();
  expect(beam.angle).toBe(angle); expect(game.pendingHit).toBe(-1);
  game.px = beam.x + Math.cos(angle) * 245; game.py = beam.y + Math.sin(angle) * 245;
  game.update(); expect(game.pendingHit).toBeGreaterThanOrEqual(0);
  const outside = start(1, true, difficulty); outside.phaseFrame = 104; outside.update();
  const safe = outside.galaxyFlash!;
  outside.px = safe.x + Math.cos(safe.angle) * 245 - Math.sin(safe.angle) * (safe.width / 2 + 8);
  outside.py = safe.y + Math.sin(safe.angle) * 245 + Math.cos(safe.angle) * (safe.width / 2 + 8);
  outside.invincible = false; outside.invulnFrames = 0;
  run(outside, safe.warning); expect(outside.pendingHit).toBe(-1);
  expect(outside.lives).toBe(2);
  outside.invincible = true; run(outside, GALAXY_FIRE);
  expect(outside.galaxyFlash).toBeUndefined();
});

it('フラッシュはポーズ中に進まず、ボムと技切替で消える', () => {
  const game = start(1, true); run(game, 130);
  const beam = game.galaxyFlash!; const age = beam.age;
  game.scene = 'pause'; run(game, 50); expect(beam.age).toBe(age);
  game.scene = 'stage'; game.bombFrames = 90; game.update(); expect(game.galaxyFlash).toBeUndefined();
  game.bombFrames = 0; game.phaseFrame = 104; game.update(); expect(game.galaxyFlash).toBeDefined();
  game.skipPhase(); expect(game.galaxyFlash).toBeUndefined();
});

it('英単語の全キーがQWERTY配列と同じ座標から落ち、Normalは6文字になる', () => {
  const game = start(1);
  let previous = '';
  for (let wave = 0; wave < 9; wave++) {
    game.bullets.clear(); game.phaseFrame = 104 + wave * 170; game.update();
    expect(game.keyboardWord).toHaveLength(6);
    expect(game.keyboardWord).not.toBe(previous); previous = game.keyboardWord;
    expect(active(game).map((b) => b.keyLabel).join('')).toBe(game.keyboardWord);
    for (const key of active(game)) {
      const row = KEY_ROWS.findIndex((keys) => keys.includes(key.keyLabel!));
      const column = KEY_ROWS[row].indexOf(key.keyLabel!);
      expect(column).toBeGreaterThanOrEqual(0);
      expect([key.x, key.y]).toEqual(keyPosition(row, column));
      expect(key.delay).toBeGreaterThan(0);
    }
  }
});

it('単語候補は配列上にある異なるキーで構成し、難易度ごとに文字数を増やす', () => {
  for (const [level, words] of KEY_WORDS.entries()) for (const word of words) {
    expect(new Set(word).size).toBe(word.length);
    expect([...word].every((letter) => KEY_ROWS.some((row) => row.includes(letter)))).toBe(true);
    if (level === 0) expect(word.length).toBeLessThanOrEqual(4);
    else expect(word.length).toBe([0, 6, 8, 9][level]);
    if (level > 0) expect(new Set([...word].map((letter) => KEY_ROWS.findIndex((row) => row.includes(letter)))).size).toBeGreaterThanOrEqual(2);
  }
});

it('キーは乱数の異なる候補から選び、次の技へ単語を持ち越さない', () => {
  const first = start(1), last = start(1);
  vi.spyOn(Math, 'random').mockReturnValue(0);
  first.phaseFrame = 104; first.update();
  vi.mocked(Math.random).mockReturnValue(0.999);
  last.phaseFrame = 104; last.update();
  expect(first.keyboardWord).not.toBe(last.keyboardWord);
  first.skipPhase(); expect(first.keyboardWord).toBe('');
});

it.each([
  ['KeyH', -1, 0], ['KeyJ', 0, 1], ['KeyK', 0, -1], ['KeyL', 1, 0],
] as const)('技の開始直後から%sで移動する', (key, dx, dy) => {
  const game = start(3); game.px = 192; game.py = 300;
  game.keys.add(key); game.update();
  expect(game.vimMovementActive).toBe(true);
  expect(game.px).toBeCloseTo(192 + dx * 3.65);
  expect(game.py).toBeCloseTo(300 + dy * 3.65);
});

it.each(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD'])('技の間は%sで動けない', (key) => {
  const game = start(3); game.keys.add(key);
  const origin = [game.px, game.py]; run(game, 5);
  expect([game.px, game.py]).toEqual(origin);
});

it('HJKLの斜め移動も等速で、Shiftと逆向きの矢印を同時押しできる', () => {
  const game = start(3); game.px = 192; game.py = 300;
  for (const key of ['KeyH', 'KeyK', 'ShiftLeft', 'ArrowRight', 'ArrowDown']) game.keys.add(key);
  game.update();
  expect(192 - game.px).toBeCloseTo(1.65 / Math.SQRT2);
  expect(300 - game.py).toBeCloseTo(1.65 / Math.SQRT2);
});

it('ボムと被弾でHJKL制限は解けず、ポーズ中は移動と弾幕が止まる', () => {
  const game = start(3); game.phaseFrame = 104 + VIM_PREPARE[1]; game.update();
  expect(active(game).length).toBeGreaterThan(0);
  game.scene = 'pause'; game.keys.add('KeyH');
  const origin = [game.px, game.py, game.phaseFrame, active(game)[0].y]; run(game, 30);
  expect([game.px, game.py, game.phaseFrame, active(game)[0].y]).toEqual(origin);
  game.scene = 'stage'; game.bombFrames = 90; game.update();
  expect(active(game)).toHaveLength(0); expect(game.vimMovementActive).toBe(true);
  game.bombFrames = 0; game.invincible = false; game.invulnFrames = 0; game.pendingHit = 7;
  game.update(); expect(game.lives).toBe(1); expect(game.vimMovementActive).toBe(true);
});

it.each(['skip', 'defeat', 'timeout'] as const)('%sで技が終わると矢印移動へ戻り、HJKLでは動かない', (end) => {
  const game = start(3);
  if (end === 'skip') game.skipPhase();
  else {
    if (end === 'defeat') game.phaseHp = 0;
    else game.phaseFrame = game.phase!.duration * 60 - 1;
    game.update();
  }
  expect(game.vimMovementActive).toBe(false); expect(active(game)).toHaveLength(0);
  game.px = 192; game.py = 300; game.keys.add('KeyH'); game.update();
  expect(game.px).toBe(192);
  game.keys.add('ArrowRight'); game.update(); expect(game.px).toBeCloseTo(195.65);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sでは操作に慣れる猶予の後、抜け道付きの横列と扇弾が出る', (difficulty) => {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const game = start(3, false, difficulty); game.phaseFrame = 104; game.update();
  run(game, VIM_PREPARE[level] - 1); expect(active(game)).toHaveLength(0);
  game.update(); const row = active(game);
  expect(row.length).toBeGreaterThan(8);
  expect(row.every(b => b.vx === 0 && b.vy > 0 && b.motion === 'normal' && !b.keyLabel)).toBe(true);
  expect(row.some(b => Math.abs(b.x - 192) < 36)).toBe(false);
  const period = [126, 114, 102, 90][level];
  run(game, period + Math.floor(period / 2));
  expect(active(game).some(b => b.vx !== 0 && b.color === 2)).toBe(true);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sの横列に端まで固定の安全列が残らない', (difficulty) => {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const game = start(3, false, difficulty), unsafe = new Set<number>();
  const period = [126, 114, 102, 90][level];
  for (let wave = 0; wave < 16; wave++) {
    game.bullets.clear(); game.phaseFrame = 104 + VIM_PREPARE[level] + wave * period; game.update();
    const row = active(game);
    for (let x = 9; x <= 375; x++) {
      if (row.some(b => bulletContact(x, 320, b.x, 320, b.radius, false) === 'hit')) unsafe.add(x);
    }
  }
  expect(unsafe.size).toBe(367);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sでも上端の自機へ横列を直接重ねず、画面外から降らせる', (difficulty) => {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const game = start(3, false, difficulty); game.invincible = false; game.invulnFrames = 0;
  game.px = 96; game.py = 12; game.phaseFrame = 104 + VIM_PREPARE[level]; game.update();
  const row = active(game);
  expect(row.length).toBeGreaterThan(8);
  expect(row.every(b => b.y < 0 && b.vy > 0)).toBe(true);
  expect(game.pendingHit).toBe(-1); expect(game.lives).toBe(2);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('Enterは%sでも行の穴を残して一斉に落ち、同じX座標に居続けられない', (difficulty) => {
  const game = start(6, false, difficulty);
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const unsafe = new Set<number>(); const layouts: number[][] = [];
  for (let wave = 0; wave < 12; wave++) {
    game.bullets.clear(); const scene = enterScene(wave * enterScene(0, level).period, level);
    game.phaseFrame = 104 + wave * scene.period;
    run(game, scene.release);
    const row = active(game);
    expect(row.length).toBeGreaterThan(8);
    expect(row.every((b) => b.y === scene.y && Math.abs(b.x - scene.gapX) >= scene.gap / 2)).toBe(true);
    layouts.push(row.map((b) => b.x));
    for (let x = 12; x <= 372; x++) if (row.some((b) => Math.abs(x - b.x) <= b.radius + 2.5)) unsafe.add(x);
    game.update(); expect(row.every((b) => b.y > scene.y)).toBe(true);
  }
  expect(new Set(layouts.map((xs) => xs.join(','))).size).toBe(12);
  expect(unsafe.size).toBe(361);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('Vimの%sは文字付きキーを使わず、60秒の弾数を抑える', (difficulty) => {
  const game = start(3, false, difficulty);
  for (let i = 0; i < 3598; i++) {
    game.update(); expect(game.bullets.count).toBeLessThanOrEqual(104);
    expect(active(game).every((b) => b.kind === 'orb' && !b.keyLabel)).toBe(true);
  }
});

