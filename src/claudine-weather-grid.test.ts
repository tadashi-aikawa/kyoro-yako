import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { emitChangingGrid, emitTypographyRain, GRID_PERIOD, gridPoint, gridVelocity, RAIN_FONTS, RAIN_GLYPHS, WEATHER_PERIOD } from './patterns/claudine-weather-grid';

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
  expect(counts[1]).toBeGreaterThan(counts[0] * 2);
  expect(counts[2]).toBeGreaterThan(counts[1]);
  expect(glyphs.size).toBe(RAIN_GLYPHS.length); expect(fonts.size).toBe(RAIN_FONTS.length);
});

it('台風は次の周回で逆向きに吹く', () => {
  const right = start(3); const left = start(3);
  emitTypographyRain(right, WEATHER_PERIOD * 2);
  emitTypographyRain(left, WEATHER_PERIOD * 5);
  expect(right.bullets.objects.filter((b) => b.active).every((b) => b.vx > 0)).toBe(true);
  expect(left.bullets.objects.filter((b) => b.active).every((b) => b.vx < 0)).toBe(true);
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

it('台風は風上側の壁からも流れ込み、下隅へ届く', () => {
  for (const cycle of [0, 1]) {
    const game = start(3);
    game.phaseFrame = 104 + WEATHER_PERIOD * (cycle * 3 + 2);
    const probes = (cycle === 0 ? [9, 40, 80] : [375, 344, 304]).map((x) => [x, 398]);
    const hits = probes.map(() => 0);
    for (let frame = 0; frame < WEATHER_PERIOD; frame++) {
      game.update();
      for (const [i, [x, y]] of probes.entries()) if (game.bullets.objects.some((b) => b.active && Math.hypot(b.x - x, b.y - y) <= b.radius + 2.5)) hits[i]++;
    }
    expect(hits.every((n) => n > 0), `${cycle}: ${hits}`).toBe(true);
  }
});

it('終符の文字の雨は10秒で3天候を再演し、文字と書体を混ぜ、次の技で消す', () => {
  const game = start(9); game.phaseFrame = 704;
  const glyphs = new Set<number>(); const fonts = new Set<number>();
  const winds: number[] = [];
  for (let frame = 0; frame < 600; frame++) {
    game.update();
    const fresh = game.bullets.objects.filter((b) => b.active && b.age === 1);
    for (const b of fresh) {
      expect(b.motion).toBe('typographyRain');
      glyphs.add(b.gridColumn); fonts.add(b.gridRow);
      if (frame < 200) expect(b.vy).toBeLessThan(1.8);
      else if (frame < 400) expect(b.vy).toBeGreaterThan(2);
      else { expect(b.spin).not.toBe(0); winds.push(b.vx); }
    }
  }
  expect(glyphs.size).toBe(12); expect(fonts.size).toBe(3);
  expect(winds.length).toBeGreaterThan(0);
  game.update();
  expect(game.bullets.objects.some((b) => b.active && b.motion === 'typographyRain')).toBe(false);
  expect(game.bullets.objects.some((b) => b.active && b.motion === 'layoutGrid')).toBe(true);
});

it('終符のグリッドは軽量な4配置を10秒で予告・一斉移動し、次の技で消す', () => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    const game = start(9); game.difficulty = difficulty; game.phaseFrame = 1304;
    const directions = new Set<string>();
    for (let frame = 0; frame < 600; frame++) {
      game.update();
      const fresh = game.bullets.objects.filter((b) => b.active && b.age === 1);
      if (frame % 150 === 0) {
        expect(fresh.length).toBeGreaterThan(0);
        expect(fresh.every((b) => b.motion === 'layoutGrid' && b.delay > 0)).toBe(true);
        if (difficulty === 'normal') expect(fresh).toHaveLength([48, 32, 44, 40][Math.floor(frame / 150)]);
      }
      for (const b of game.bullets.objects) if (b.active) {
        expect(b.motion).not.toBe('gridSnap');
        if (b.motion === 'normal') directions.add(b.vx > 0 ? 'right' : b.vx < 0 ? 'left' : b.vy > 0 ? 'down' : 'up');
      }
    }
    expect([...directions].sort()).toEqual(['down', 'left', 'right', 'up']);
    game.update();
    expect(game.bullets.objects.filter((b) => b.active).every((b) => b.motion === 'complement')).toBe(true);
  }
});
