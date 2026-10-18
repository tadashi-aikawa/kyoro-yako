import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { GALAXY_FIRE } from './patterns/etokichi';
import { enterScene, KEY_ROWS, KEY_WORDS, keyPosition, VIM_PERIOD, vimScene } from './patterns/neo';
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
  { command: '5Gyy3p', wave: 0, line: 5, copies: 3, remove: 0 },
  { command: '3Gyy2p', wave: 1, line: 3, copies: 2, remove: 0 },
  { command: '4G2dd', wave: 2, line: 4, copies: 0, remove: 2 },
  { command: '2Gyy3p', wave: 3, line: 2, copies: 3, remove: 0 },
  { command: '6Gdd', wave: 4, line: 6, copies: 0, remove: 1 },
])('Vimの$commandは指定行を編集し、貼り付けと削除で後続行も詰め直す', ({ command, wave, line, copies, remove }) => {
  const game = start(3);
  game.phaseFrame = 104 + wave * VIM_PERIOD; game.update();
  const scene = vimScene(wave * VIM_PERIOD, 1);
  expect(scene.command).toBe(command);
  const originals = active(game).map((b) => ({ b, row: b.gridRow, y: b.y }));
  const source = originals.filter(({ row }) => row === line - 1).map(({ b }) => [b.x, b.gridColumn, b.keyLabel]);
  run(game, scene.warning);
  expect(vimScene(game.phaseFrame - 105, 1).cursorRow).toBe(line - 1);
  expect(originals.every(({ b, y }) => b.y === y)).toBe(true);
  run(game, scene.launchAt - scene.warning - 1);
  expect(new Set(active(game).map((b) => b.gridRow)).size).toBe(7 + copies - remove);
  if (copies) for (let row = line; row < line + copies; row++) {
    expect(active(game).filter((b) => b.gridRow === row).map((b) => [b.x, b.gridColumn, b.keyLabel])).toEqual(source);
  }
  for (const { b, row } of originals) {
    if (remove && row >= line - 1 && row < line - 1 + remove) expect(b.active).toBe(false);
    else {
      expect(b.gridRow).toBe(row + (copies && row >= line ? copies : 0) - (remove && row >= line - 1 + remove ? remove : 0));
      expect(b.y).toBe(104 + b.gridRow * 24);
    }
  }
  const living = active(game); const y = living[0].y;
  game.update(); expect(living[0].y).toBeGreaterThan(y);
  expect(living.every((b) => b.motion === 'normal')).toBe(true);
});

it('Vimの編集は無害で、発射後だけ同じ場所の自機へ当たる', () => {
  const game = start(3); game.phaseFrame = 104; game.update();
  const b = active(game).find((b) => b.gridRow === 0)!;
  game.px = b.x; game.py = b.y; game.invincible = false; game.invulnFrames = 0;
  run(game, vimScene(0, 1).launchAt - 1);
  expect(game.pendingHit).toBe(-1); expect(game.lives).toBe(2);
  game.update(); expect(game.pendingHit).toBeGreaterThanOrEqual(0);
});

it('Vimはポーズで止まり、ボム後は同じ波を復活させず次のコマンドから再開する', () => {
  const game = start(3); game.phaseFrame = 104; game.update();
  const frame = game.phaseFrame, age = active(game)[0].age;
  game.scene = 'pause'; run(game, 40);
  expect(game.phaseFrame).toBe(frame); expect(active(game)[0].age).toBe(age);
  game.scene = 'stage'; game.bombFrames = 2; game.update(); game.bombFrames = 0;
  run(game, VIM_PERIOD - 2); expect(active(game)).toHaveLength(0);
  game.update(); expect(active(game).length).toBeGreaterThan(0);
  game.skipPhase(); expect(active(game)).toHaveLength(0);
});

it('5面の再演でも5Gyy3pで7行を10行にする', () => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(5); game.startBoss(true, 0); game.encoreCount = 2;
  game.phaseFrame = 104; game.update();
  run(game, vimScene(0, 1).launchAt - 1);
  expect(new Set(active(game).map((b) => b.gridRow)).size).toBe(10);
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

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('Vimの%sは列間と壁際を塞ぎ、Normal以上は1波の中でも静止して避け続けられない', (difficulty) => {
  const game = start(3, false, difficulty);
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  for (let wave = 0; wave < 5; wave++) {
    game.bullets.clear(); game.phaseFrame = 104 + wave * VIM_PERIOD; game.update();
    run(game, vimScene(wave * VIM_PERIOD, level).launchAt - 1);
    const keys = active(game);
    for (const row of new Set(keys.map((b) => b.gridRow))) {
      const line = keys.filter((b) => b.gridRow === row).sort((a, b) => a.x - b.x);
      expect(line[0].x - line[0].radius - 2.5).toBeLessThanOrEqual(9);
      for (let i = 1; i < line.length; i++) if (line[i].gridColumn === line[i - 1].gridColumn + 1) {
        expect(line[i].x - line[i - 1].x).toBeLessThan(line[i].radius + line[i - 1].radius + 5);
      }
    }
    if (difficulty !== 'easy') for (let x = 9; x <= 375; x++) {
      expect(keys.some((b) => Math.abs(x - b.x) <= b.radius + 2.5), `wave ${wave}, x ${x}`).toBe(true);
    }
  }
});

