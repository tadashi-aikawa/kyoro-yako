import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { GALAXY_FIRE } from './patterns/etokichi';
import { enterScene, KEY_ROWS, KEY_WORDS, keyPosition, VIM_COMMANDS, VIM_PERIOD, vimScene } from './patterns/neo';
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

it.each(VIM_COMMANDS)('Vimの%sはコマンド予告が終わってから通常弾を発射する', (command) => {
  const game = start(3);
  const wave = VIM_COMMANDS.indexOf(command);
  game.phaseFrame = 104 + wave * VIM_PERIOD; game.update();
  const scene = vimScene(wave * VIM_PERIOD, 1);
  expect(scene.command).toBe(command); expect(game.vimAttack?.wave).toBe(wave);
  run(game, scene.warning - 1); expect(active(game)).toHaveLength(0);
  game.update(); expect(active(game)).toHaveLength(9);
  expect(active(game).every((b) => b.kind === 'orb' && !b.keyLabel && b.vy > 0)).toBe(true);
});

it('3jは下向きの扇を3回発射する', () => {
  const game = start(3); game.phaseFrame = 104; game.update(); run(game, vimScene(0, 1).warning + 40);
  expect(active(game)).toHaveLength(27);
  expect(new Set(active(game).map((b) => b.dashOrder))).toEqual(new Set([0, 1, 2]));
  expect(active(game).every((b) => b.vy > 0)).toBe(true);
});

it.each([['2h', -1], ['2l', 1]] as const)('%sは自然な弾道を保って横へ2段ずらす', (command, sign) => {
  const game = start(3), wave = VIM_COMMANDS.indexOf(command);
  game.phaseFrame = 104 + wave * VIM_PERIOD; game.update(); run(game, vimScene(wave * VIM_PERIOD, 1).warning);
  const b = active(game)[4], x = b.x;
  const shift = () => b.x - x - b.vx * (b.age - 1);
  run(game, 17); expect(shift()).toBeCloseTo(0);
  run(game, 12); expect(shift()).toBeCloseTo(sign * 21.6);
  run(game, 12); expect(shift()).toBeCloseTo(sign * 21.6);
  run(game, 12); expect(shift()).toBeCloseTo(sign * 43.2);
  game.update(); expect(b.motion).toBe('normal');
});

it('yy3pは発射元と速度をコピーし、照準を引き直さず3回追加する', () => {
  const game = start(3), wave = VIM_COMMANDS.indexOf('yy3p'); game.phaseFrame = 104 + wave * VIM_PERIOD; game.update();
  run(game, vimScene(wave * VIM_PERIOD, 1).warning);
  const origin = { ...game.vimAttack! };
  const velocities = active(game).map((b) => [b.vx, b.vy]);
  game.px = 350; run(game, 108);
  expect(active(game)).toHaveLength(36);
  for (let volley = 1; volley <= 3; volley++) {
    const copies = active(game).filter((b) => b.dashOrder === volley);
    expect(copies.map((b) => [b.vx, b.vy])).toEqual(velocities);
    for (const b of copies) { expect(b.x - b.vx * b.age).toBeCloseTo(origin.x); expect(b.y - b.vy * b.age).toBeCloseTo(origin.y); }
  }
});

it('ddは先行する扇だけを消し、後続の扇を残す', () => {
  const game = start(3), wave = VIM_COMMANDS.indexOf('dd'); game.phaseFrame = 104 + wave * VIM_PERIOD; game.update();
  run(game, vimScene(wave * VIM_PERIOD, 1).warning);
  const first = active(game).slice(); run(game, 49);
  expect(active(game)).toHaveLength(18); game.update();
  expect(first.every((b) => !b.active)).toBe(true);
  expect(active(game)).toHaveLength(9); expect(active(game).every((b) => b.dashOrder === 1)).toBe(true);
});

it('3j2hyypは3連射を2段左へずらしてから、移動後の扇を一組コピーする', () => {
  const game = start(3), wave = VIM_COMMANDS.indexOf('3j2hyyp');
  game.phaseFrame = 104 + wave * VIM_PERIOD; game.update(); run(game, vimScene(wave * VIM_PERIOD, 1).warning);
  const origin = { ...game.vimAttack! };
  run(game, 95); expect(active(game).every((b) => b.dashOrder < 3)).toBe(true);
  run(game, 41);
  const copies = active(game).filter((b) => b.dashOrder >= 3);
  expect(copies).toHaveLength(27);
  expect(new Set(copies.map((b) => b.dashOrder))).toEqual(new Set([3, 4, 5]));
  for (const b of copies) { expect(b.motion).toBe('normal'); expect(b.x - b.vx * b.age).toBeCloseTo(origin.x - 43.2); }
});

it.each([['2lyy2p', 1, 3], ['2hyy3p', -1, 4]] as const)('%sは横移動した射撃を指定回数コピーする', (command, sign, volleys) => {
  const game = start(3), wave = VIM_COMMANDS.indexOf(command);
  game.phaseFrame = 104 + wave * VIM_PERIOD; game.update(); run(game, vimScene(wave * VIM_PERIOD, 1).warning);
  const origin = { ...game.vimAttack! };
  run(game, 56 + (volleys - 2) * 24);
  expect(new Set(active(game).map((b) => b.dashOrder)).size).toBe(volleys);
  for (const b of active(game).filter((b) => b.dashOrder > 0)) expect(b.x - b.vx * b.age).toBeCloseTo(origin.x + sign * 43.2);
});

it('Vimはポーズで止まり、ボム後のコピー射撃を中止して次の予告から再開する', () => {
  const game = start(3), wave = VIM_COMMANDS.indexOf('yy3p'); game.phaseFrame = 104 + wave * VIM_PERIOD; game.update();
  const frame = game.phaseFrame;
  game.scene = 'pause'; run(game, 40);
  expect(game.phaseFrame).toBe(frame); expect(game.vimAttack?.wave).toBe(wave);
  game.scene = 'stage'; run(game, vimScene(wave * VIM_PERIOD, 1).warning + 36);
  game.bombFrames = 2; game.update(); game.bombFrames = 0; expect(game.vimAttack).toBeUndefined();
  while (game.phaseFrame < 104 + (wave + 1) * VIM_PERIOD) game.update();
  expect(active(game)).toHaveLength(0);
  game.update(); expect(game.vimAttack?.wave).toBe(wave + 1);
  game.skipPhase(); expect(active(game)).toHaveLength(0); expect(game.vimAttack).toBeUndefined();
});

it('被弾が確定したらコピー射撃を中止する', () => {
  const game = start(3), wave = VIM_COMMANDS.indexOf('yy3p');
  game.phaseFrame = 104 + wave * VIM_PERIOD; game.update(); run(game, vimScene(wave * VIM_PERIOD, 1).warning);
  game.invincible = false; game.invulnFrames = 0; game.pendingHit = 7;
  game.update(); expect(game.lives).toBe(1); expect(game.vimAttack).toBeUndefined();
  run(game, 108); expect(active(game).every((b) => b.dashOrder === 0)).toBe(true);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sでも全コマンドの最後のコピーまで次の予告前に出る', (difficulty) => {
  const volleys = [3, 6, 1, 3, 4, 4, 1, 3, 2];
  for (const [wave, count] of volleys.entries()) {
    const game = start(3, false, difficulty); game.phaseFrame = 104 + wave * VIM_PERIOD;
    const seen = new Set<number>();
    for (let i = 0; i < VIM_PERIOD; i++) { game.update(); for (const b of active(game)) seen.add(b.dashOrder); }
    expect([...seen].sort((a, b) => a - b), `${difficulty} ${VIM_COMMANDS[wave]}`).toEqual(Array.from({ length: count }, (_, i) => i));
  }
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

