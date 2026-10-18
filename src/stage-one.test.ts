import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { GALAXY_FIRE } from './patterns/etokichi';
import { enterScene, KEY_ROWS, KEY_WORDS, keyPosition, VIM_COMMANDS, VIM_PERIOD } from './patterns/neo';
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

it.each(VIM_COMMANDS)('Vimの%sは予告後に本来の方向へ1マス動き、ddなら横1行を消す', (command) => {
  const game = start(3);
  const wave = VIM_COMMANDS.indexOf(command);
  game.phaseFrame = 104 + wave * VIM_PERIOD; game.update();
  const keys = active(game).map((b) => ({ bullet: b, x: b.x, y: b.y }));
  const warning = keys[0].bullet.delay;
  expect(keys.every(({ bullet }) => bullet.keyLabel === command)).toBe(true);
  run(game, warning);
  expect(keys.every(({ bullet, x, y }) => bullet.x === x && bullet.y === y)).toBe(true);
  run(game, 48);
  if (command === 'dd') {
    expect(keys.filter(({ bullet }) => !bullet.active).map(({ bullet }) => bullet.gridRow)).toEqual(Array(10).fill(1));
  } else {
    for (const { bullet, x, y } of keys) {
      expect(bullet.x - x).toBeCloseTo(command === 'h' ? -32 : command === 'l' ? 32 : 0);
      expect(bullet.y - y).toBe(command === 'j' ? 34 : command === 'k' ? -34 : 0);
    }
  }
  const living = active(game); const y = living[0].y;
  game.update(); expect(living[0].y).toBeGreaterThan(y);
  expect(living.every((b) => b.motion === 'normal')).toBe(true);
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

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('Vimは%sでも列の間に全波共通の固定安全地帯を残さない', (difficulty) => {
  const game = start(3, false, difficulty);
  const unsafe = new Set<number>();
  for (let wave = 0; wave < 10; wave++) {
    game.bullets.clear(); game.phaseFrame = 104 + wave * VIM_PERIOD; game.update();
    const row = active(game).filter((b) => b.gridRow === 0);
    for (let x = 12; x <= 372; x++) if (row.some((b) => Math.abs(x - b.targetX - b.sway) <= b.radius + 2.5)) unsafe.add(x);
  }
  expect(unsafe.size).toBe(361);
});

