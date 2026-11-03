import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { emitRainbow, RAINBOW_BURST, RAINBOW_COLORS, RAINBOW_LIMIT, RAINBOW_PERIOD, RAINBOW_PHRASE, RAINBOW_SECTION, rainbowCurvePosition, rainbowSection, updateRainbowBullet } from './patterns/claudine-rainbow';
import { bulletContact, type Difficulty, FIELD } from './rules';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => vi.unstubAllGlobals());

function start(difficulty: Difficulty = 'normal', t = 0): Game {
  const game = new Game(); game.audio.volume = 0; game.difficulty = difficulty;
  game.startStage(3); game.startBoss(false, 8); game.phaseFrame = 104 + t;
  game.invulnFrames = 0; game.invincible = true;
  return game;
}

it('8秒ごとに扇・渦巻き・蛇行と分離へ進み、次の24秒では向きを反転する', () => {
  const fan = start(); fan.update();
  expect(fan.phase?.name).toBe('レインボー・ヴェール');
  const first = fan.bullets.objects.filter(b => b.active);
  expect(first).toHaveLength(42);
  expect(new Set(first.map(b => b.color)).size).toBe(RAINBOW_COLORS.length);
  expect(new Set(first.map(b => b.gridRow)).size).toBe(3);
  const cross = start('normal', RAINBOW_SECTION); cross.update();
  const xs = cross.bullets.objects.filter(b => b.active).map(b => b.x);
  expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(120);
  const next = start('normal', RAINBOW_SECTION * 3); next.update();
  expect(next.bullets.objects.find(b => b.active)!.spin).toBe(-first[0].spin);
  expect([0, 479, 480, 959, 960, 1439, 1440].map(rainbowSection)).toEqual([0, 0, 1, 1, 2, 2, 0]);
});

it('場面を切り替えても飛んでいる虹を残し、別の軌道を重ねる', () => {
  const game = start();
  for (let frame = 0; frame < 480; frame++) game.update();
  const old = game.bullets.objects.filter(b => b.active);
  const ages = old.map(b => b.age);
  const spawn = vi.spyOn(game, 'spawnBullet'); game.update();
  expect(old.filter((b, i) => b.active && b.age > ages[i]).length).toBeGreaterThan(200);
  expect(spawn).toHaveBeenCalledTimes(42);
});

it('渦巻きは弾そのものが周回し、上下にも折り返す', () => {
  const game = start('normal', RAINBOW_SECTION); game.update();
  const b = game.bullets.objects.find(b => b.active && b.color === 0 && b.gridRow === 2)!;
  let previous = Math.sign(b.vx), reversals = 0, upward = false;
  for (let age = 2; age <= 210; age++) {
    b.age = age; updateRainbowBullet(game, b);
    const direction = Math.sign(b.vx);
    if (direction !== previous) reversals++;
    previous = direction; upward ||= b.vy < -0.1;
    expect(b.active).toBe(true);
  }
  expect(reversals).toBeGreaterThanOrEqual(3); expect(upward).toBe(true);
});

it('蛇行は下降しながら左右へ繰り返し折り返し、扇とは別の軌道になる', () => {
  const fan = start(); fan.update();
  expect(rainbowCurvePosition(fan.bullets.objects.find(b => b.active)!, 40)).toBeUndefined();
  const game = start('normal', RAINBOW_SECTION * 2); game.update();
  const b = game.bullets.objects.find(b => b.active && b.color === 0 && b.gridRow === 0)!;
  let previous = Math.sign(b.vx), reversals = 0, minX = b.x, maxX = b.x;
  for (let age = 2; age <= 190; age++) {
    b.age = age; updateRainbowBullet(game, b);
    const direction = Math.sign(b.vx);
    if (direction !== previous) reversals++;
    previous = direction; minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x);
    expect(b.vy).toBeGreaterThan(0); expect(b.active).toBe(true);
  }
  expect(reversals).toBeGreaterThanOrEqual(2); expect(maxX - minX).toBeGreaterThan(30);
});

it('渦巻きのスロットを扇が再利用しても、前の曲線を引き継がない', () => {
  const game = start('normal', RAINBOW_SECTION); game.update();
  const old = game.bullets.objects.find(b => b.active)!;
  expect(rainbowCurvePosition(old, 40)).toBeDefined();
  while (game.bullets.objects.length < 2600) game.spawnBullet(192, 200, 0, 0, 0);
  game.bullets.clear(); emitRainbow(game, 0);
  expect(old.active).toBe(true); expect(old.dashWave).toBe(0);
  expect(rainbowCurvePosition(old, 40)).toBeUndefined();
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sは次の24秒で渦巻きの周回と蛇行の折り返しを反転する', difficulty => {
  function representative(section: number, cycle: number) {
    const game = start(difficulty, RAINBOW_SECTION * (section + cycle * 3)); game.update();
    return game.bullets.objects.find(b => b.active && b.color === 0 && b.gridRow === 0)!;
  }
  function winding(b: ReturnType<typeof representative>) {
    const p = [90, 91, 92, 93].map(age => rainbowCurvePosition(b, age)!);
    const ax = p[2][0] - 2 * p[1][0] + p[0][0], ay = p[2][1] - 2 * p[1][1] + p[0][1];
    const bx = p[3][0] - 2 * p[2][0] + p[1][0], by = p[3][1] - 2 * p[2][1] + p[1][1];
    return ax * by - ay * bx;
  }
  // 中心の直線移動を除いた加速度の回転から、実際の周回方向を確かめる。
  expect(winding(representative(1, 0))).toBeLessThan(0);
  expect(winding(representative(1, 1))).toBeGreaterThan(0);
  const first = representative(2, 0), next = representative(2, 1);
  // 両周期の代表弾が同じ飛翔時間で左右逆向きに進むことを、座標から確認する。
  expect(rainbowCurvePosition(first, 91)![0] - rainbowCurvePosition(first, 90)![0]).toBeGreaterThan(0);
  expect(rainbowCurvePosition(next, 91)![0] - rainbowCurvePosition(next, 90)![0]).toBeLessThan(0);
});

it('第3区間のリボンが3粒の宝石弾へ分かれる', () => {
  const game = start('normal', 960); game.update();
  const parent = game.bullets.objects.find(b => b.active && b.releaseAt > 0)!;
  expect(parent).toBeDefined(); expect(parent.split).toBe(false);
  parent.age = 124;
  const spawn = vi.spyOn(game, 'spawnBullet'); game.update();
  expect(spawn).toHaveBeenCalledTimes(3);
  const children = spawn.mock.results.map(result => result.value).filter(Boolean);
  expect(children).toHaveLength(3);
  expect(children.every(b => b.dashWave === 1 && b.releaseAt === 0 && b.split === false && b.launchSoundPending === false)).toBe(true);
  expect(new Set(children.map(b => Math.atan2(b.vy, b.vx))).size).toBe(3);
  expect(game.bullets.objects.filter(b => b.active && b.gridRow < 2).every(b => b.releaseAt === 0)).toBe(true);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sは七色をまとめて放ち、次のまとまりまで移動する間隔を空ける', difficulty => {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty), game = start(difficulty);
  const spawn = vi.spyOn(game, 'spawnBullet');
  emitRainbow(game, 0); expect(spawn).toHaveBeenCalledTimes(level === 0 ? 28 : 42);
  spawn.mockClear();
  for (let t = RAINBOW_BURST[level]; t < RAINBOW_PHRASE[level]; t++) emitRainbow(game, t);
  expect(spawn).not.toHaveBeenCalled();
  emitRainbow(game, RAINBOW_PHRASE[level]); expect(spawn).toHaveBeenCalledTimes(level === 0 ? 28 : 42);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sは区間と左右反転の境目でも連射の間隔を保つ', difficulty => {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty), game = start(difficulty);
  const spawn = vi.spyOn(game, 'spawnBullet'), times: number[] = [];
  for (let t = 0; t <= RAINBOW_SECTION * 6; t++) {
    spawn.mockClear(); emitRainbow(game, t);
    if (spawn.mock.results.some(result => result.value?.dashWave === 0)) times.push(t);
    game.bullets.clear();
  }
  const period = RAINBOW_PERIOD[level];
  const gap = RAINBOW_PHRASE[level] - (Math.ceil(RAINBOW_BURST[level] / period) - 1) * period;
  expect(times.filter(t => t < RAINBOW_SECTION)).toHaveLength([12, 18, 20, 35][level]);
  for (let i = 1; i < times.length; i++) {
    const distance = times[i] - times[i - 1];
    expect([period, gap]).toContain(distance);
    if (times[i] % RAINBOW_SECTION === 0) expect(distance).toBe(gap);
  }
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sは第3区間のすべてのまとまりで最外層の先頭を分離する', difficulty => {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty), game = start(difficulty);
  const outer = level === 0 ? 1 : 2, spawn = vi.spyOn(game, 'spawnBullet');
  for (const sectionStart of [RAINBOW_SECTION * 2, RAINBOW_SECTION * 5]) {
    for (let phrase = 0; phrase < RAINBOW_SECTION; phrase += RAINBOW_PHRASE[level]) {
      game.bullets.clear(); spawn.mockClear(); emitRainbow(game, sectionStart + phrase);
      const parents = spawn.mock.results.map(result => result.value).filter(b => b && b.releaseAt > 0);
      expect(parents).toHaveLength(14);
      expect(parents.every(b => b!.gridRow === outer)).toBe(true);
      expect(new Set(parents.map(b => b!.color)).size).toBe(7);
      game.bullets.clear(); spawn.mockClear(); emitRainbow(game, sectionStart + phrase + RAINBOW_PERIOD[level]);
      expect(spawn.mock.results.every(result => result.value?.releaseAt === 0)).toBe(true);
    }
  }
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sは異なる自機狙いの位置でも下側の射線近くに通れる幅を残す', difficulty => {
  for (const targetX of [120, 192, 260]) {
    const game = start(difficulty); game.px = targetX;
    let minimum = Infinity;
    for (let frame = 0; frame < 3450; frame++) {
      game.update();
      const [bx] = game.bossPosition(), left = bx - 96, right = bx + 96;
      let widest = 0;
      for (const y of [352, 390, 428]) {
        const blocked: [number, number][] = [];
        game.bullets.forEach(b => {
          if (b.delay > 0) return;
          const radius = 2.5 + b.radius + 2, dy = y - b.y;
          if (Math.abs(dy) >= radius) return;
          const dx = Math.sqrt(radius ** 2 - dy ** 2);
          if (b.x + dx >= left && b.x - dx <= right) blocked.push([Math.max(left, b.x - dx), Math.min(right, b.x + dx)]);
        });
        blocked.sort((a, b) => a[0] - b[0]);
        let x = left;
        for (const [from, to] of blocked) { widest = Math.max(widest, from - x); x = Math.max(x, to); }
        widest = Math.max(widest, right - x);
      }
      minimum = Math.min(minimum, widest);
    }
    // 幅の検査は撃破ボットと独立させる。移動できること自体は次の実入力テストで確かめる。
    expect(minimum, `target x=${targetX}`).toBeGreaterThanOrEqual(24);
  }
});

it('画面内の限度に近い分離では、同じ弾を宝石形へ変えて弾を消さない', () => {
  const game = start('normal', 960); game.update();
  const parent = game.bullets.objects.find(b => b.active && b.releaseAt > 0)!;
  while (game.bullets.count < RAINBOW_LIMIT[1]) game.spawnBullet(192, 200, 0, 0, 0);
  parent.age = 124; game.update();
  expect(parent.active).toBe(true); expect(parent.dashWave).toBe(1); expect(parent.releaseAt).toBe(0);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sで60秒近く進めても弾プールは飽和せず、全3区間に弾幕が続く', difficulty => {
  const game = start(difficulty), spawn = vi.spyOn(game, 'spawnBullet');
  let peak = 0; const kinds = new Set<number>(), colors = new Set<number>();
  const coverage = new Set<number>(); const sections = [0, 0, 0];
  for (let frame = 0; frame < 3450; frame++) {
    game.update(); const count = game.bullets.count; peak = Math.max(peak, count);
    if (frame >= 240) sections[rainbowSection(frame)] = Math.max(sections[rainbowSection(frame)], count);
    game.bullets.forEach(b => {
      if (b.motion !== 'rainbowVeil') return;
      kinds.add(b.dashWave); colors.add(b.color);
      if (b.delay > 0 || Math.abs(b.y - (FIELD.h - 9)) > 5) return;
      for (let x = Math.max(9, Math.ceil(b.x - 5)); x <= Math.min(FIELD.w - 9, Math.floor(b.x + 5)); x++) {
        if (bulletContact(x, FIELD.h - 9, b.x, b.y, b.radius, false) === 'hit') coverage.add(x);
      }
    });
  }
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  expect(peak).toBeGreaterThan(250); expect(peak).toBeLessThanOrEqual(RAINBOW_LIMIT[level]);
  expect(sections.every(count => count > 150)).toBe(true);
  expect([...kinds].sort()).toEqual([0, 1]); expect(colors.size).toBe(7);
  expect(spawn.mock.results.every(result => result.value !== undefined)).toBe(true);
  expect(coverage.size).toBe(FIELD.w - 17);
});

it('中央で待つだけでは当たり、固定の安全な穴はない', () => {
  const game = start(); game.invincible = false;
  for (let frame = 0; frame < 900 && game.pendingHit < 0; frame++) game.update();
  expect(game.pendingHit).toBeGreaterThanOrEqual(0);
});

it.each([0, 1, 2, 3, 4])('射撃開始のフレーム差%dでもNormalを下側から無被弾・ボムなしで撃破できる', offset => {
  const game = start(); game.invincible = false; game.power = 3; game.frame = offset;
  const horizons = [6, 12, 20, 30, 44, 64];
  let defeated = false;
  for (let frame = 0; frame < 3495 && game.phaseIndex === 8; frame++) {
    // 約0.13秒ごとに判断する。画面下側から出ず、移動・低速・射撃だけを入力する。
    if (frame % 8 === 0) {
      const nearby = game.bullets.objects.filter(b => b.active && b.motion === 'rainbowVeil' && Math.abs(b.x - game.px) < 200 && Math.abs(b.y - game.py) < 250)
        .sort((a, b) => Math.hypot(a.x - game.px, a.y - game.py) - Math.hypot(b.x - game.px, b.y - game.py)).slice(0, 200);
      const future: [number, number, number][][] = horizons.map(() => []);
      for (const b of nearby) {
        let x = b.x, y = b.y, vx = b.vx, vy = b.vy, index = 0;
        const cs = Math.cos(b.spin), sn = Math.sin(b.spin);
        for (let t = 1; t <= 64; t++) {
          if (t > b.delay) { const next = vx * cs - vy * sn; vy = vx * sn + vy * cs + b.sway; vx = next; x += vx; y += vy; }
          if (t === horizons[index]) { future[index].push([x, y, 2.5 + b.radius + 2]); index++; }
        }
      }
      let best = Infinity, chosen = { dx: 0, dy: 0, focus: true };
      const bx = game.bossPosition()[0];
      for (const focus of [true, false]) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const speed = (focus ? 1.65 : 3.65) / (Math.hypot(dx, dy) || 1);
        if (dy < 0 && game.py + dy * speed * 8 < 320) continue;
        let cost = (focus ? 0 : 0.15) + (dx * dx + dy * dy) * 0.08;
        for (let i = 0; i < horizons.length; i++) {
          const t = horizons[i], x = Math.max(9, Math.min(375, game.px + dx * speed * t)), y = Math.max(320, Math.min(439, game.py + dy * speed * t));
          if (i === horizons.length - 1) cost += Math.abs(x - bx) * 0.1 + Math.abs(y - 380) * 0.025 + Math.max(0, 24 - Math.min(x, 384 - x)) * 0.2;
          for (const [fx, fy, radius] of future[i]) {
            const d = Math.hypot(x - fx, y - fy);
            if (d < radius) cost += 80000 / (t + 4);
            else if (d < 24) cost += (24 - d) ** 2 / (t + 10);
          }
        }
        if (cost < best) { best = cost; chosen = { dx, dy, focus }; }
      }
      game.keys.clear(); game.keys.add('KeyZ');
      if (chosen.focus) game.keys.add('ShiftLeft');
      if (chosen.dx) game.keys.add(chosen.dx < 0 ? 'ArrowLeft' : 'ArrowRight');
      if (chosen.dy) game.keys.add(chosen.dy < 0 ? 'ArrowUp' : 'ArrowDown');
    }
    const remaining = game.phase!.duration * 60 - game.phaseFrame;
    game.update();
    expect(game.py).toBeGreaterThanOrEqual(320);
    expect(game.pendingHit).toBe(-1); expect(game.invulnFrames).toBe(0); expect(game.bombFrames).toBe(0);
    if (game.phaseIndex !== 8) defeated = remaining > 1;
  }
  expect(defeated).toBe(true);
  expect(game.phase?.pattern).toBe('final');
});

it('ボム中には追加射撃と分離を出さず、次の技へ虹を持ち越さない', () => {
  const game = start('normal', 960);
  for (let frame = 0; frame < 200; frame++) game.update();
  expect(game.bullets.count).toBeGreaterThan(0);
  game.bombFrames = 150;
  const spawn = vi.spyOn(game, 'spawnBullet');
  for (let frame = 0; frame < 120; frame++) game.update();
  expect(game.bullets.count).toBe(0); expect(spawn).not.toHaveBeenCalled();
  game.bombFrames = 0;
  for (let frame = 0; frame < 160; frame++) game.update();
  expect(game.bullets.count).toBeGreaterThan(0);
  game.phaseHp = 0; game.update();
  expect(game.bullets.count).toBe(0);
});

it('技の開始前とボム中には虹を生成しない', () => {
  const game = start(); emitRainbow(game, -1);
  expect(game.bullets.count).toBe(0);
  game.bombFrames = 1; emitRainbow(game, 0);
  expect(game.bullets.count).toBe(0);
});

it('親のスロットを分離弾が再利用しても、宝石弾が再分裂しない', () => {
  const game = start('normal', 960); game.update();
  const parent = game.bullets.objects.find(b => b.active && b.releaseAt > 0)!;
  while (game.bullets.objects.length < 2600) game.spawnBullet(192, 200, 0, 0, 0);
  // 分離対象の直前のスロットを使い、次のacquireが親から探す状態にする。
  game.bullets.objects[game.bullets.objects.indexOf(parent) - 1].active = false;
  game.spawnBullet(192, 200, 0, 0, 0);
  game.bullets.forEach(b => { if (b !== parent) b.active = false; });
  parent.age = 124;
  const spawn = vi.spyOn(game, 'spawnBullet'); game.update();
  const children = spawn.mock.results.map(result => result.value).filter(Boolean);
  expect(children).toHaveLength(3); expect(children).toContain(parent);
  expect(children.every(b => b.active && b.dashWave === 1 && b.releaseAt === 0 && b.split === false)).toBe(true);
  expect(children.every(b => rainbowCurvePosition(b, b.age + 40) === undefined)).toBe(true);
});

it('分離弾は生成フレームに当たらず、翌フレームから通常の当たり判定を持つ', () => {
  const game = start('normal', 960); game.update();
  const parent = game.bullets.objects.find(b => b.active && b.releaseAt > 0)!;
  game.bullets.forEach(b => { if (b !== parent) b.active = false; });
  const position = rainbowCurvePosition(parent, 125)!;
  game.px = position[0]; game.py = position[1]; parent.age = 124;
  game.invincible = false; game.invulnFrames = 0;
  game.update(); expect(game.pendingHit).toBe(-1);
  game.update(); expect(game.pendingHit).toBeGreaterThanOrEqual(0);
});
