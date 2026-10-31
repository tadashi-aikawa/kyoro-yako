import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { emitChangingGrid, emitTypographyRain, GRID_PERIOD, gridPoint, gridVelocity, RAIN_FONTS, RAIN_GLYPHS, RAIN_TRANSITION, WEATHER_PERIOD } from './patterns/claudine-weather-grid';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => vi.unstubAllGlobals());

function start(index: number): Game {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(3); game.startBoss(false, index);
  return game;
}

it('文字の雨は12文字と3種類の書体を混ぜ、小雨から豪雨・台風へ密度を上げる', () => {
  const counts: number[] = [];
  const glyphs = new Set<number>(); const fonts = new Set<number>();
  for (let weather = 0; weather < 3; weather++) {
    const game = start(3);
    for (let t = weather * WEATHER_PERIOD; t < (weather + 1) * WEATHER_PERIOD; t++) emitTypographyRain(game, t);
    const bullets = game.bullets.objects.filter((b) => b.active);
    counts.push(bullets.length);
    for (const b of bullets) { glyphs.add(b.gridColumn); fonts.add(b.gridRow); }
    expect(bullets.every((b) => b.kind === 'glyph' && b.motion === 'typographyRain')).toBe(true);
    if (weather === 2) expect(bullets.every((b) => b.sway > 1 && b.spin !== 0 && b.vx > 1)).toBe(true);
  }
  expect(counts[1]).toBeGreaterThan(counts[0]);
  expect(counts[2]).toBeGreaterThan(counts[1]);
  expect(glyphs.size).toBe(RAIN_GLYPHS.length); expect(fonts.size).toBe(RAIN_FONTS.length);
});

it('台風は次の周回で逆向きに吹く', () => {
  const right = start(3); const left = start(3);
  for (let t = 0; t < WEATHER_PERIOD; t++) {
    emitTypographyRain(right, WEATHER_PERIOD * 2 + t);
    emitTypographyRain(left, WEATHER_PERIOD * 5 + t);
  }
  expect(right.bullets.count).toBeGreaterThan(0); expect(left.bullets.count).toBeGreaterThan(0);
  expect(right.bullets.objects.filter((b) => b.active).every((b) => b.vx > 0)).toBe(true);
  expect(left.bullets.objects.filter((b) => b.active).every((b) => b.vx < 0)).toBe(true);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sの小雨を保ち、豪雨と台風は従来の6割以下の発射数へ抑える', difficulty => {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const counts = [0, 1, 2].map(weather => {
    const game = start(3); game.difficulty = difficulty;
    for (let local = 0; local < WEATHER_PERIOD; local++) emitTypographyRain(game, weather * WEATHER_PERIOD + local);
    return game.bullets.count;
  });
  expect(counts[0]).toBe([24, 54, 80, 120][level]);
  const previousHeavy = Math.ceil(WEATHER_PERIOD / [8, 5, 4, 3][level]) * [3, 4, 5, 6][level];
  const previousTyphoon = Math.ceil(WEATHER_PERIOD / [6, 4, 3, 3][level]) * [5, 6, 7, 8][level];
  expect(counts[1]).toBeLessThanOrEqual(previousHeavy * 0.6);
  expect(counts[2]).toBeLessThanOrEqual(previousTyphoon * 0.6);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sの豪雨・台風へ入ると残弾が消えてから次の雨が始まる', difficulty => {
  for (const weather of [1, 2]) {
    const game = start(3); game.difficulty = difficulty;
    game.phaseFrame = 104 + WEATHER_PERIOD * weather - 1;
    // 画面内の遅い残弾を置き、自然な画面外退出で通過しないようにする。
    const old = game.spawnBullet(192, 250, 0, 0, 0, 'glyph')!;
    old.motion = 'typographyRain';
    game.update(); expect(old.active).toBe(true);
    for (let frame = 0; frame < RAIN_TRANSITION; frame++) {
      game.update();
      expect(game.bullets.objects.some(b => b.active && b !== old)).toBe(false);
    }
    expect(old.active).toBe(false);
    for (let frame = 0; frame < 12; frame++) game.update();
    expect(game.bullets.count).toBeGreaterThan(0);
  }
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sの小雨へ戻ると台風の残弾だけ消し、小雨は待たずに発射する', difficulty => {
  const game = start(3); game.difficulty = difficulty;
  game.phaseFrame = 104 + WEATHER_PERIOD * 3;
  const old = game.spawnBullet(192, 250, 0, 0, 0, 'glyph')!;
  old.motion = 'typographyRain';
  for (let frame = 0; frame <= 30; frame++) game.update();
  expect(old.active).toBe(false);
  const unchanged = start(3); unchanged.difficulty = difficulty;
  for (let t = WEATHER_PERIOD * 3; t <= WEATHER_PERIOD * 3 + 30; t++) emitTypographyRain(unchanged, t);
  expect(game.bullets.count).toBeGreaterThan(0);
  expect(game.bullets.count).toBe(unchanged.bullets.count);
});

it('グリッドは均等列・可変幅・可変行・千鳥配置へ切り替わる', () => {
  const layouts: string[] = [];
  for (let layout = 0; layout < 4; layout++) {
    const game = start(5); emitChangingGrid(game, layout * GRID_PERIOD[1]);
    const bullets = game.bullets.objects.filter((b) => b.active);
    expect(bullets).toHaveLength([60, 40, 55, 50][layout]);
    expect(bullets.every((b) => b.delay > 0 && b.motion === 'layoutGrid')).toBe(true);
    layouts.push(bullets.map((b) => `${b.targetX}:${b.targetY}:${b.releaseAt}`).join(','));
  }
  expect(new Set(layouts).size).toBe(4);
  expect(gridPoint(3, 1, 0)[0]).toBeGreaterThan(gridPoint(3, 0, 0)[0]);
});

it('グリッドは静止した位置を通り、待機だけでは終わらない', () => {
  for (const [x, y] of [[192, 398], [40, 390], [344, 390], [192, 20]]) {
    const game = start(5); game.invincible = false; game.px = x; game.py = y;
    const lives = game.lives;
    game.phaseFrame = 104; game.update();
    for (let t = 0; t < 700 && game.lives === lives; t++) game.update();
    expect(game.lives, `${x},${y}`).toBeLessThan(lives);
  }
});

it('グリッドは予告位置から配置を保って上下左右へ流れ、自機の移動では向きを変えない', () => {
  for (let layout = 0; layout < 4; layout++) {
    const game = start(5); game.phaseFrame = 104 + layout * GRID_PERIOD[1]; game.update();
    const bullets = game.bullets.objects.filter((b) => b.active);
    const initial = bullets.map((b) => [b.x, b.y]);
    for (let frame = 0; frame < 69; frame++) game.update();
    expect(bullets.every((b, i) => b.x === initial[i][0] && b.y === initial[i][1])).toBe(true);
    game.update();
    const [vx, vy] = gridVelocity(layout, 1);
    for (const [i, b] of bullets.entries()) {
      expect(b.motion).toBe('normal'); expect(b.vx).toBe(vx); expect(b.vy).toBe(vy);
      expect(b.x).toBeCloseTo(initial[i][0] + vx); expect(b.y).toBeCloseTo(initial[i][1] + vy);
    }
    game.px = 30; game.py = 80; game.update();
    expect(bullets.every((b) => b.vx === vx && b.vy === vy)).toBe(true);
  }
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sの台風は間引いた後も風上側の壁から流れ込み、画面下部へ届く', difficulty => {
  for (const cycle of [0, 1]) {
    const game = start(3); game.difficulty = difficulty;
    game.phaseFrame = 104 + WEATHER_PERIOD * (cycle * 3 + 2);
    const spawn = vi.spyOn(game, 'spawnBullet');
    const sideBullets = new Set<ReturnType<Game['spawnBullet']>>();
    let reachesLowerField = false;
    for (let frame = 0; frame < WEATHER_PERIOD; frame++) {
      game.update();
      for (const [index, [x]] of spawn.mock.calls.entries()) if (x < 0 || x > 384) sideBullets.add(spawn.mock.results[index].value);
      for (const b of sideBullets) if (b?.active && b.x >= 9 && b.x <= 375 && b.y >= 330 && b.y <= 439) reachesLowerField = true;
    }
    expect(sideBullets.size).toBeGreaterThan(0);
    expect(reachesLowerField, `cycle ${cycle}`).toBe(true);
    spawn.mockRestore();
  }
});
