import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { drawRainbowBackdrop, RAINBOW_COLORS, RAINBOW_GAP, RAINBOW_PERIOD, RAINBOW_SPEED, RAINBOW_WARNING, rainbowGap } from './patterns/claudine-rainbow';
import { bulletContact, type Difficulty, FIELD } from './rules';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => vi.unstubAllGlobals());

function start(difficulty: Difficulty = 'normal'): Game {
  const game = new Game(); game.audio.volume = 0; game.difficulty = difficulty;
  game.startStage(3); game.startBoss(false, 8); game.phaseFrame = 104;
  game.invulnFrames = 0; game.invincible = false;
  return game;
}

it('虹は七色の同じアーチを予告し、予告中には当たり判定がない', () => {
  const game = start(); game.update();
  const bullets = game.bullets.objects.filter(b => b.active);
  expect(game.phase?.name).toBe('レインボー・ヴェール');
  expect(new Set(bullets.map(b => b.color)).size).toBe(RAINBOW_COLORS.length);
  expect(bullets.every(b => b.motion === 'rainbowVeil' && b.delay > 0)).toBe(true);
  const b = bullets[0];
  b.x = b.targetX = game.px = 192; b.y = b.targetY = game.py = 300;
  for (let frame = 1; frame < RAINBOW_WARNING[1]; frame++) game.update();
  expect(game.pendingHit).toBe(-1);
  expect(b.age).toBe(RAINBOW_WARNING[1]);
  game.update();
  expect(game.pendingHit).toBeGreaterThanOrEqual(0);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sは下部の切れ目を低速移動でたどり、被弾せず60秒近く避け続けられる', difficulty => {
  const game = start(difficulty), level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  game.py = 398;
  const lives = game.lives;
  let peak = 0, minX = 192, maxX = 192;
  for (let t = 0; t < 3450; t++) {
    const passage = (game.py + 55) / RAINBOW_SPEED[level];
    const wave = Math.max(0, Math.round((t - RAINBOW_WARNING[level] - passage) / RAINBOW_PERIOD[level]));
    const age = Math.max(0, t - wave * RAINBOW_PERIOD[level] - RAINBOW_WARNING[level]);
    const target = rainbowGap(wave, age);
    game.keys.clear(); game.keys.add('ShiftLeft');
    if (Math.abs(target - game.px) > 0.825) game.keys.add(target < game.px ? 'ArrowLeft' : 'ArrowRight');
    game.update();
    expect(game.pendingHit, `frame=${t} x=${game.px}`).toBe(-1);
    expect(game.lives).toBe(lives);
    peak = Math.max(peak, game.bullets.count); minX = Math.min(minX, game.px); maxX = Math.max(maxX, game.px);
  }
  expect(game.phase?.pattern).toBe('rainbow');
  expect(maxX - minX).toBeGreaterThan(80);
  expect(peak).toBeGreaterThan(350); expect(peak).toBeLessThan(1000);
  expect(game.bullets.objects.length).toBeLessThanOrEqual(2600);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sは各段が最下段の切れ目以外を両端まで覆う', difficulty => {
  const game = start(difficulty); game.invincible = true;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const touched = Array.from({ length: 8 }, () => new Set<number>());
  const gaps = Array.from({ length: 8 }, () => [Infinity, -Infinity]);
  for (let frame = 0; frame < 3450; frame++) {
    game.update();
    game.bullets.forEach(b => {
      if (b.delay > 0 || b.gridColumn >= 8 || Math.abs(b.y - (FIELD.h - 9)) > 5) return;
      const gap = rainbowGap(b.gridColumn, b.age - b.releaseAt), bounds = gaps[b.gridColumn];
      bounds[0] = Math.min(bounds[0], gap - RAINBOW_GAP[level] / 2 - 2);
      bounds[1] = Math.max(bounds[1], gap + RAINBOW_GAP[level] / 2 + 2);
      for (let x = Math.max(9, Math.ceil(b.x - 5)); x <= Math.min(FIELD.w - 9, Math.floor(b.x + 5)); x++) {
        if (bulletContact(x, FIELD.h - 9, b.x, b.y, b.radius, false) === 'hit') touched[b.gridColumn].add(x);
      }
    });
  }
  for (let wave = 0; wave < 8; wave++) for (let x = 9; x <= FIELD.w - 9; x++) {
    if (x >= gaps[wave][0] && x <= gaps[wave][1]) continue;
    expect(touched[wave].has(x), `wave=${wave} x=${x}`).toBe(true);
  }
});

it('ボムで虹を消し、次の技へ進んだら虹の弾を持ち越さない', () => {
  const game = start();
  for (let frame = 0; frame < 600; frame++) game.update();
  expect(game.bullets.count).toBeGreaterThan(0);
  game.bombFrames = 150; game.update();
  expect(game.bullets.count).toBe(0);
  game.bombFrames = 0;
  for (let frame = 0; frame < 300; frame++) game.update();
  expect(game.bullets.count).toBeGreaterThan(0);
  game.phaseHp = 0; game.update();
  expect(game.bullets.count).toBe(0);
  expect(game.bullets.objects.some(b => b.active && b.motion === 'rainbowVeil')).toBe(false);
});

for (const home of [60, 330]) it.each(['easy', 'normal', 'hard', 'lunatic'] as const)(`%sはx=${home}付近の列間に留まるだけでは抜けられない`, difficulty => {
  const game = start(difficulty); game.px = home; game.py = 398;
  for (let t = 0; t < 3450 && game.pendingHit < 0; t++) {
    let wave = -1, distance = Infinity;
    game.bullets.forEach(b => {
      if (b.motion !== 'rainbowVeil' || b.delay > 0 || Math.abs(b.x - home) > 40) return;
      const dy = game.py - b.y;
      if (dy > -8 && dy < distance) { distance = dy; wave = b.gridColumn; }
    });
    let target = home;
    if (wave >= 0) {
      const xs = [...new Set(game.bullets.objects.filter(b => b.active && b.motion === 'rainbowVeil' && b.gridColumn === wave && Math.abs(b.x - home) < 40).map(b => b.x))].sort((a, b) => a - b);
      const anchor = distance < 90 ? game.px : home;
      let nearest = Infinity;
      for (let i = 1; i < xs.length; i++) {
        const middle = (xs[i - 1] + xs[i]) / 2;
        if (Math.abs(middle - anchor) < nearest) { nearest = Math.abs(middle - anchor); target = middle; }
      }
    }
    game.keys.clear(); game.keys.add('ShiftLeft');
    if (Math.abs(target - game.px) > 0.825) game.keys.add(target < game.px ? 'ArrowLeft' : 'ArrowRight');
    game.update();
  }
  expect(game.pendingHit).toBeGreaterThanOrEqual(0);
});

it('画面外にある次の虹の切れ目を、HUDより下の七色の柱で予告する', () => {
  const game = start(); game.update();
  const moveTo = vi.fn(), lineTo = vi.fn();
  const context = { save() {}, restore() {}, fillRect() {}, beginPath() {}, ellipse() {}, stroke() {}, moveTo, lineTo } as unknown as CanvasRenderingContext2D;
  drawRainbowBackdrop(context, game);
  const left = moveTo.mock.calls.filter(([x]) => x < 192), right = moveTo.mock.calls.filter(([x]) => x > 192);
  expect(left).toHaveLength(7); expect(right).toHaveLength(7);
  expect(moveTo.mock.calls.every(([x, y]) => x > 9 && x < FIELD.w - 9 && y > 90 && y < 220)).toBe(true);
  expect(lineTo).toHaveBeenCalledTimes(14);
  for (let frame = 1; frame < RAINBOW_WARNING[1]; frame++) game.update();
  moveTo.mockClear(); drawRainbowBackdrop(context, game);
  expect(moveTo).not.toHaveBeenCalled();
});

it('赤が外側、紫が内側に並び、虹の形がうねっても下降は逆転しない', () => {
  const game = start('easy'); game.invincible = true; game.update();
  const colors = game.bullets.objects.filter(b => b.active && b.gridRow === 8).sort((a, b) => a.color - b.color);
  expect(colors).toHaveLength(7);
  expect(colors.every((b, i) => i === 0 || b.y > colors[i - 1].y)).toBe(true);
  const left = colors[0], right = game.bullets.objects.find(b => b.active && b.color === 0 && b.targetX > 310 && b.targetX < 330)!;
  const initial = [left.y, right.y];
  for (let frame = 0; frame < RAINBOW_WARNING[0] + 120; frame++) {
    const before = [left.y, right.y]; game.update();
    expect(left.y).toBeGreaterThanOrEqual(before[0]); expect(right.y).toBeGreaterThanOrEqual(before[1]);
  }
  expect(Math.abs((left.y - initial[0]) - (right.y - initial[1]))).toBeGreaterThan(4);
});

it('発射音と構えは予告中に出さず、虹が動き始める瞬間に一度だけ出す', () => {
  const game = start(); game.invincible = true;
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  const cast = vi.spyOn(game, 'triggerBossCast');
  for (let frame = 0; frame < RAINBOW_WARNING[1]; frame++) game.update();
  expect(play).not.toHaveBeenCalledWith('enemyShot'); expect(cast).not.toHaveBeenCalled();
  game.update();
  expect(play.mock.calls.filter(([sound]) => sound === 'enemyShot')).toHaveLength(1);
  expect(cast).toHaveBeenCalledTimes(1);
  for (let frame = 0; frame < 60; frame++) game.update();
  expect(play.mock.calls.filter(([sound]) => sound === 'enemyShot')).toHaveLength(1);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sは切れ目を低速移動しながらPower3で連射して35秒以内に撃破できる', difficulty => {
  const game = start(difficulty), level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  game.py = 398; game.power = 3;
  const lives = game.lives;
  let frame = 0;
  for (; frame < 2100 && game.phaseIndex === 8; frame++) {
    const passage = (game.py + 55) / RAINBOW_SPEED[level];
    const wave = Math.max(0, Math.round((frame - RAINBOW_WARNING[level] - passage) / RAINBOW_PERIOD[level]));
    const age = Math.max(0, frame - wave * RAINBOW_PERIOD[level] - RAINBOW_WARNING[level]);
    const target = rainbowGap(wave, age);
    game.keys.clear(); game.keys.add('ShiftLeft'); game.keys.add('KeyZ');
    if (Math.abs(target - game.px) > 0.825) game.keys.add(target < game.px ? 'ArrowLeft' : 'ArrowRight');
    game.update();
    expect(game.pendingHit, `frame=${frame}`).toBe(-1);
  }
  expect(game.phaseIndex).toBe(9); expect(frame).toBeLessThan(2100); expect(game.lives).toBe(lives);
});
