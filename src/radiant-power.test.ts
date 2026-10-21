import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import type { ItemKind } from './rules';

const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void> = {};
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof listeners[string]) => { listeners[kind] = listener; } });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function start(power = 5): Game {
  const game = new Game(); game.audio.volume = 0;
  game.startStage(1); game.power = power;
  return game;
}
function pick(game: Game, kind: ItemKind): void {
  Object.assign(game.items.acquire()!, { x: game.px, y: game.py, vx: 0, vy: 0, kind, auto: false, manual: false });
  game.update();
}
function press(game: Game, code: string): void {
  listeners.keydown({ code, repeat: false, preventDefault: () => {} });
  game.update(); game.keys.delete(code);
}
function run(game: Game, count: number): void { for (let i = 0; i < count; i++) game.update(); }

it.each([false, true])('光の羽根を拾うと中央5本・左右3本ずつの最高形態になる: 低速=%s', (focus) => {
  const game = start(); pick(game, 'radiant');
  expect(game.awakened).toBe(true); expect(game.power).toBe(5);
  game.autoshot = true; game.frame = 9;
  if (focus) game.keys.add('ShiftLeft');
  game.update();
  const main = game.shots.objects.filter((s) => s.active && s.homing);
  const extra = game.shots.objects.filter((s) => s.active && !s.homing);
  expect(main).toHaveLength(5); expect(extra).toHaveLength(6);
  expect(main.every((s) => s.damage === 1.35 && s.vx === 0)).toBe(true);
  expect(new Set(main.map((s) => s.x)).size).toBe(5);
  expect(extra.every((s) => s.damage === 0.65)).toBe(true);
  if (focus) expect(extra.every((s) => s.vx === 0 && s.vy === main[0].vy)).toBe(true);
  else for (const side of [-1, 1]) {
    const angles = extra.filter((s) => Math.sign(s.vx) === side).map((s) => Math.atan2(Math.abs(s.vx), -s.vy) * 180 / Math.PI).sort((a, b) => a - b);
    expect(angles).toHaveLength(3);
    for (let i = 0; i < 3; i++) expect(angles[i]).toBeCloseTo([15, 30, 45][i]);
  }
});

it('最高形態の低速切り替えと毎秒104.4の全弾火力を保つ', () => {
  const game = start(); pick(game, 'radiant'); game.autoshot = true;
  for (const focus of [false, true, false]) {
    game.shots.clear(); game.frame = 9;
    if (focus) game.keys.add('ShiftLeft'); else game.keys.delete('ShiftLeft');
    game.update();
    expect(game.shots.objects.filter((s) => s.active && !s.homing).every((s) => s.vx === 0)).toBe(focus);
  }
  let damage = 0;
  for (let i = 0; i < 60; i++) {
    game.shots.clear(); game.update();
    game.shots.forEach((s) => { damage += s.damage; });
  }
  expect(damage).toBeCloseTo(104.4);
});

it('実際の被弾で解除し、Pで5へ戻しても復活せず、再取得でだけ復活する', () => {
  const game = start(); pick(game, 'radiant');
  game.invulnFrames = 0; game.spawnBullet(game.px, game.py, 0, 0, 0);
  run(game, 8);
  expect(game.power).toBe(4); expect(game.awakened).toBe(false); expect(game.lives).toBe(1);
  pick(game, 'large');
  expect(game.power).toBe(5); expect(game.awakened).toBe(false);
  game.autoshot = true; game.frame = 9; game.shots.clear(); game.update();
  expect(game.shots.objects.filter((s) => s.active && s.homing)).toHaveLength(4);
  expect(game.shots.objects.filter((s) => s.active && !s.homing)).toHaveLength(4);
  pick(game, 'radiant'); expect(game.awakened).toBe(true);
});

it.each([0, 3, 4, 4.99])('落下中の光の羽根をPower%sで拾っても最高形態にはならない', (power) => {
  const game = start(power); pick(game, 'radiant');
  expect(game.power).toBe(Math.min(5, power + 1)); expect(game.awakened).toBe(false);
});

it('最高形態中の重複取得は点アイテムの最大値になる', () => {
  const game = start(); pick(game, 'radiant');
  game.point = 12300; const score = game.score;
  pick(game, 'radiant');
  expect(game.score - score).toBe(12300); expect(game.awakened).toBe(true); expect(game.power).toBe(5);
});

it('喰らいボム成功時は最高形態を保つ', () => {
  const game = start(); pick(game, 'radiant');
  game.invulnFrames = 0; game.spawnBullet(game.px, game.py, 0, 0, 0); run(game, 7);
  expect(game.pendingHit).toBe(7);
  press(game, 'KeyX');
  expect(game.pendingHit).toBe(-1); expect(game.awakened).toBe(true);
  expect(game.power).toBe(5); expect(game.lives).toBe(2); expect(game.bombs).toBe(2);
});

it('ステージ移動・通常ボム・ポーズのやり直しで最高形態を保つ', () => {
  const game = start(); pick(game, 'radiant'); game.startStage(2);
  expect(game.awakened).toBe(true);
  press(game, 'KeyX'); expect(game.awakened).toBe(true);
  press(game, 'Escape'); expect(game.scene).toBe('pause'); game.menu = 2;
  press(game, 'Enter'); expect(game.scene).toBe('stage'); expect(game.awakened).toBe(true);
});

it.each(['difficulty', 'practice', 'gameover'] as const)('%sから新しいプレイを始めると最高形態を解除する', (scene) => {
  const game = start(); pick(game, 'radiant'); game.scene = scene; game.menu = 0;
  press(game, 'Enter');
  expect(game.awakened).toBe(false); expect(game.power).toBe(0); expect(game.scene).toBe('stage');
});

it.each([0, 4.99, 5])('検証クエリmaxform=1もPower%sの条件を守る', (power) => {
  vi.stubGlobal('location', { search: `?stage=1&power=${power}&maxform=1` });
  const game = new Game(); expect(game.awakened).toBe(power === 5); expect(game.debugState.maxform).toBe(Number(power === 5));
});

it.each([0, 0.002999, 0.003, 0.012999, 0.013, 0.062999, 0.063, 0.719999, 0.72, 0.996999, 0.997, 0.999999])('雑魚抽選値%sは既存ドロップを保ち、Power5の未強化時だけ0.3%%で光の羽根を出す', (roll) => {
  for (const [power, awakened] of [[4.99, false], [5, false], [5, true]] as const) {
    const game = start(power); game.awakened = awakened;
    const enemy = game.enemies.acquire()!; enemy.hp = 0; enemy.x = 192; enemy.y = 70;
    vi.mocked(Math.random).mockReturnValue(roll); game.update();
    const old = roll < 0.003 ? 'life' : roll < 0.013 ? 'bomb' : roll < 0.063 ? 'large' : roll < 0.72 ? 'small' : 'point';
    const expected = power === 5 && !awakened && roll >= 0.997 ? 'radiant' : old;
    expect(game.items.objects.filter((item) => item.active).map((item) => item.kind)).toEqual([expected]);
  }
});

it.each([[1, false], [4, false], [5, false], [5, true]] as const)('%s面のボス補充で光の羽根もライフと同率になり、P・ライフ・ボムは維持する: 中ボス=%s', (stage, mid) => {
  const multiplier = stage >= 4 && !mid ? 2 : 1;
  for (const [power, awakened] of [[4.99, false], [5, false], [5, true]] as const) {
    for (const baseRoll of [0, 0.019999, 0.02, 0.319999, 0.32, 0.339999, 0.34, 0.499999]) {
      const game = start(power); game.awakened = awakened; game.startStage(stage); game.startBoss(mid, 0);
      const roll = baseRoll * multiplier;
      vi.mocked(Math.random).mockReturnValueOnce(roll); game.skipPhase();
      const drops = game.items.objects.filter((item) => item.active);
      const bonus = baseRoll < 0.02 ? 'life' : baseRoll < 0.32 ? 'bomb' : power === 5 && !awakened && baseRoll < 0.34 ? 'radiant' : undefined;
      expect(drops.filter((item) => item.kind === 'small')).toHaveLength(10 * multiplier);
      expect(drops.filter((item) => item.kind !== 'small').map((item) => item.kind)).toEqual(bonus ? [bonus] : []);
      expect(drops.every((item) => item.manual && !item.auto)).toBe(true);
    }
  }
});
