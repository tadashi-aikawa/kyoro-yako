import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { emitChangingGrid, emitTypographyRain, GRID_PERIOD, gridPoint, gridVelocity, RAIN_FONTS, RAIN_GLYPHS, WEATHER_PERIOD } from './patterns/claudine-weather-grid';
import { bulletContact, FIELD } from './rules';

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
    expect(bullets.find(b => b.radius > 3.5)!.vy).toBeGreaterThan(bullets.find(b => b.radius < 2.5)!.vy);
    if (weather === 2) expect(bullets.every((b) => b.spin !== 0 && b.vx > b.vy)).toBe(true);
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

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sの小雨を保ち、豪雨・台風の発射密度を段階的に上げる', difficulty => {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const counts = [0, 1, 2].map(weather => {
    const game = start(3); game.difficulty = difficulty;
    for (let local = 0; local < WEATHER_PERIOD; local++) emitTypographyRain(game, weather * WEATHER_PERIOD + local);
    return game.bullets.count;
  });
  expect(counts[0]).toBe([24, 54, 80, 120][level]);
  expect(counts[1]).toBeGreaterThan(counts[0]);
  expect(counts[2]).toBeGreaterThan(counts[1]);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sの全切替で残弾を残し、発射を待たずに同じ文字を加減速・転向させる', difficulty => {
  for (let step = 1; step <= 6; step++) {
    const weather = step % 3;
    const boundary = WEATHER_PERIOD * step;
    const game = start(3); game.difficulty = difficulty;
    // 切替直前の実際の発射弾を、自然退出しない画面内へ置く。
    for (let t = boundary - 20; t < boundary; t++) emitTypographyRain(game, t);
    const old = game.bullets.objects.find(b => b.active)!;
    old.x = 192; old.y = 100;
    const before = { vx: old.targetX, vy: old.vy, rotation: old.rotation, glyph: old.gridColumn, font: old.gridRow, radius: old.radius };
    const unrelated = game.spawnBullet(50, 50, 0, 0, 0)!;
    game.phaseFrame = 104 + boundary;
    const spawn = vi.spyOn(game, 'spawnBullet');
    for (let frame = 0; frame < 40; frame++) {
      game.update();
      expect(old.active).toBe(true);
      expect(old.fadeAt).toBe(0);
      if (frame === 12) expect(spawn).toHaveBeenCalled();
    }
    expect([old.gridColumn, old.gridRow, old.radius]).toEqual([before.glyph, before.font, before.radius]);
    expect([unrelated.x, unrelated.y, unrelated.vx, unrelated.vy, unrelated.fadeAt]).toEqual([50, 50, 0, 0, 0]);
    if (weather === 1) {
      expect(old.vy).toBeGreaterThan(before.vy * 1.5);
      expect(Math.abs(old.targetX)).toBeLessThan(0.01);
    } else if (weather === 2) {
      const direction = step === 2 ? 1 : -1;
      expect(old.targetX * direction).toBeGreaterThan(old.vy);
      expect(old.rotation * direction).toBeGreaterThan(before.rotation * direction);
    } else {
      expect(Math.abs(old.targetX)).toBeLessThan(Math.abs(before.vx) * 0.05);
      expect(Math.abs(old.spin)).toBeLessThan(0.0003);
    }
    spawn.mockRestore();
  }
});

it('天候切替の最初のフレームで速度と位置が飛ばない', () => {
  const game = start(3);
  const b = game.spawnBullet(192, 150, 0, 3.08, 0, 'glyph')!;
  b.motion = 'typographyRain'; b.radius = 3;
  game.phaseFrame = 104 + WEATHER_PERIOD * 2;
  game.update();
  expect(b.targetX).toBeGreaterThan(0);
  expect(b.targetX).toBeLessThan(0.4);
  expect(Math.abs(b.vy - 3.08)).toBeLessThan(0.2);
  expect(Math.abs(b.x - 192)).toBeLessThan(0.4);
  expect(Math.abs(b.y - 150)).toBeLessThan(3.1);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sで2周連続して雨が途切れず、豪雨では画面内の密度も上がる', difficulty => {
  const game = start(3); game.difficulty = difficulty; game.phaseFrame = 104;
  const counts: number[][] = [[], [], []];
  for (let t = 0; t < WEATHER_PERIOD * 7; t++) {
    game.update();
    const step = Math.floor(t / WEATHER_PERIOD);
    if (t >= WEATHER_PERIOD && t % WEATHER_PERIOD < 40) expect(game.bullets.count).toBeGreaterThan(0);
    game.bullets.forEach(b => {
      expect(b.fadeAt).toBe(0);
      expect(b.radius).toBeGreaterThanOrEqual(2.4);
      expect(b.radius).toBeLessThanOrEqual(3.6);
    });
    if (step >= 3 && step < 6 && t % WEATHER_PERIOD >= WEATHER_PERIOD / 2) counts[step % 3].push(game.bullets.count);
  }
  const means = counts.map(samples => samples.reduce((sum, n) => sum + n, 0) / samples.length);
  expect(means[1]).toBeGreaterThan(means[0] * 1.1);
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

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sでは初回の下向きグリッドの隙間で下端に居座って撃ち続けると、次の横向きグリッドに当たる', difficulty => {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const game = start(5); game.difficulty = difficulty; game.invincible = false;
  game.px = 192; game.py = FIELD.h - 9; game.keys.add('KeyZ'); game.phaseFrame = 104;
  const lives = game.lives;
  for (let frame = 0; frame < GRID_PERIOD[level]; frame++) game.update();
  expect(game.lives).toBe(lives);
  expect(game.pendingHit).toBe(-1);
  for (let frame = 0; frame < GRID_PERIOD[level] && game.lives === lives; frame++) game.update();
  expect(game.lives).toBeLessThan(lives);
  expect(game.phase?.pattern).toBe('grid');
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sでは最初の横向きグリッドが下端の全座標を通る', difficulty => {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const game = start(5); game.difficulty = difficulty;
  game.phaseFrame = 104 + GRID_PERIOD[level];
  const hit = new Set<number>();
  for (let frame = 0; frame < GRID_PERIOD[level]; frame++) {
    game.update();
    game.bullets.forEach(b => {
      if (b.delay > 0) return;
      for (let x = 9; x <= FIELD.w - 9; x++) {
        if (bulletContact(x, FIELD.h - 9, b.x, b.y, b.radius, false) === 'hit') hit.add(x);
      }
    });
  }
  expect(hit.size).toBe(FIELD.w - 17);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sでは下端から35px以内の全座標を2周以内に通る', difficulty => {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const game = start(5); game.difficulty = difficulty; game.phaseFrame = 104;
  const width = FIELD.w - 17;
  const hit = new Uint8Array(width * 36);
  for (let frame = 0; frame < GRID_PERIOD[level] * 8; frame++) {
    game.update();
    game.bullets.forEach(b => {
      if (b.delay > 0 || b.y < 392 || b.y > 445) return;
      for (let y = Math.max(404, Math.ceil(b.y - 6)); y <= Math.min(439, Math.floor(b.y + 6)); y++) {
        for (let x = Math.max(9, Math.ceil(b.x - 6)); x <= Math.min(375, Math.floor(b.x + 6)); x++) {
          if (bulletContact(x, y, b.x, b.y, b.radius, false) === 'hit') hit[(y - 404) * width + x - 9] = 1;
        }
      }
    });
  }
  const safe = Array.from(hit.entries()).filter(([, value]) => !value).slice(0, 20).map(([index]) => [9 + index % width, 404 + Math.floor(index / width)]);
  expect(safe).toEqual([]);
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

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sの台風は両方向とも風上側の壁から流れ込み、画面下部へ届く', difficulty => {
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
