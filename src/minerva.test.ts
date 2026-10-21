import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { dawnPrayerStep, emitMinerva, eyeX, INTERVIEW_PERIOD, INTERVIEW_SPEED, MINERVA_WARNING, PRAYER_CHARGE, PRAYER_FIRE, PRAYER_PERIOD } from './patterns/minerva';
import { CONSTELLATION_TIME } from './patterns/minerva-dawn';
import { interviewRingBlocksShot, interviewRingDistance, updateInterviewRings } from './patterns/minerva-ring';
import { STAGES } from './stages';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function phase(index: number, difficulty: Game['difficulty'] = 'normal'): Game {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.difficulty = difficulty; game.startStage(5); game.startBoss(false, index);
  return game;
}

it('5面は通常5回とスペル8枚を設計順に持ち、全番号に直行できる', () => {
  const phases = STAGES[4].phases;
  expect(phases).toHaveLength(13);
  expect(phases.filter((p) => p.spell)).toHaveLength(8);
  for (let index = 0; index < phases.length; index++) {
    vi.stubGlobal('location', { search: `?boss=5&phase=${index}` });
    const game = new Game();
    expect(game.phase?.name).toBe(phases[index].name);
    expect(game.phaseIndex).toBe(index);
  }
  expect(phases.map((p) => p.pattern)).toEqual([
    'minervaStarFan', 'sevenRings', 'minervaStarRings', 'question', 'minervaStarFan', 'gravityShift',
    'minervaStarRings', 'owlEye', 'minervaStarFan', 'recall', 'starFlight', 'interview', 'owlDawn',
  ]);
});

it('Easyほど共通の予告時間が長い', () => {
  expect(MINERVA_WARNING).toEqual([90, 70, 55, 42]);
});

it('視線は左右へ等速で往復し、当たる弾だけ停止する', () => {
  expect(eyeX(0)).toBe(32);
  expect(eyeX(60) - eyeX(0)).toBe(eyeX(120) - eyeX(60));
  expect(eyeX(180) - eyeX(120)).toBe(eyeX(240) - eyeX(180));
  const game = phase(7);
  const watched = game.spawnBullet(32, 200, 0, 1, 1)!;
  watched.motion = 'eyeFreeze';
  const free = game.spawnBullet(320, 200, 0, 1, 1)!;
  free.motion = 'eyeFreeze';
  game.phaseFrame = 104;
  game.update();
  expect(watched.y).toBe(200);
  expect(free.y).toBe(201);
  game.phaseFrame = 224;
  game.update();
  expect(watched.y).toBeGreaterThan(200);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('エンドレス・インクワイアリーは%sで発射間に上下左右へ動き、自機には追従せず、出した輪は動かさない', (difficulty) => {
  const game = phase(11, difficulty); const other = phase(11, difficulty);
  other.px = 25; other.py = 35;
  const origins = new Map<object, [number, number]>();
  const xs: number[] = [], ys: number[] = [];
  let previous = game.bossXY;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  for (let frame = 0; frame < INTERVIEW_PERIOD[level] * 6 + 104; frame++) {
    game.update(); other.update();
    expect(game.bossXY).toEqual(other.bossXY);
    const [x, y] = game.bossXY; xs.push(x); ys.push(y);
    expect(Math.hypot(x - previous[0], y - previous[1])).toBeLessThan(2);
    for (const ring of game.interviewRings) {
      if (!origins.has(ring)) {
        expect([ring.x, ring.y]).toEqual(game.bossXY);
        origins.set(ring, [ring.x, ring.y]);
      }
      expect([ring.x, ring.y]).toEqual(origins.get(ring));
    }
    const local = (game.phaseFrame - 105) % INTERVIEW_PERIOD[level];
    if (local === 0 || local === 1) expect(game.bossXY).toEqual(previous);
    previous = [x, y];
  }
  expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(150);
  expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(90);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('エンドレス・インクワイアリーの輪は%sで予告後に拡大しながら穴ごと回転する', (difficulty) => {
  const game = phase(11, difficulty); game.phaseFrame = 105;
  emitMinerva(game, 'interview');
  const ring = game.interviewRings[0]; const angle = ring.gap;
  for (let i = 0; i < MINERVA_WARNING[['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty)]; i++) updateInterviewRings(game);
  expect(ring.gap).toBe(angle); expect(ring.radius).toBe(45);
  for (let i = 0; i < 120; i++) updateInterviewRings(game);
  expect(ring.gap - angle).toBeGreaterThan(0.1);
  expect(ring.radius).toBeGreaterThan(45);
  expect(ring.spin * 580).toBeLessThan(3.65);
  expect(ring.spin).toBeCloseTo([0.001, 0.0012, 0.0014, 0.0016][['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty)] * 3);
  expect(interviewRingDistance(ring, ring.x + Math.cos(ring.gap) * ring.radius, ring.y + Math.sin(ring.gap) * ring.radius)).toBeGreaterThan(10);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('エンドレス・インクワイアリーは%sでも連続した輪に穴が1か所だけあり、序盤は次の穴へ移動する時間がある', (difficulty) => {
  const game = phase(11, difficulty);
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const centers: number[] = [];
  for (let wave = 0; 105 + wave * INTERVIEW_PERIOD[level] <= 1800; wave++) {
    game.interviewRings.length = 0; game.phaseFrame = 105 + wave * INTERVIEW_PERIOD[level];
    emitMinerva(game, 'interview');
    expect(game.bullets.count).toBe(0);
    expect(game.interviewRings).toHaveLength(1);
    const ring = game.interviewRings[0];
    expect(Math.sign(ring.spin)).toBe(wave % 2 ? -1 : 1);
    expect(ring.speed).toBeCloseTo(INTERVIEW_SPEED[level]);
    expect(INTERVIEW_SPEED[level]).toBeCloseTo([0.5, 0.6, 0.7, 0.8][level]);
    centers.push(ring.x + (398 - ring.y) / Math.tan(ring.gap));
    for (let step = 0; step < 360; step++) {
      const angle = ring.gap + step * Math.PI / 180;
      ring.radius = 580;
      const distance = interviewRingDistance(ring, ring.x + Math.cos(angle) * 580, ring.y + Math.sin(angle) * 580);
      if (step === 0) expect(distance).toBeGreaterThan(40);
      else if (step * Math.PI / 180 > ring.opening / 2 && step * Math.PI / 180 < Math.PI * 2 - ring.opening / 2) expect(distance).toBeLessThan(0.001);
    }
  }
  expect(Math.max(...centers) - Math.min(...centers)).toBeGreaterThan(120);
  for (let i = 1; i < centers.length; i++) {
    expect(Math.abs(centers[i] - centers[i - 1]) / 1.65 + 30).toBeLessThan(INTERVIEW_PERIOD[level]);
  }
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('エンドレス・インクワイアリーは%sで残り30秒未満から放出間隔を半分にし、回転方向の交互を保つ', (difficulty) => {
  const game = phase(11, difficulty);
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const period = INTERVIEW_PERIOD[level];
  let wave = 0;
  for (let frame = 105; frame < 3600; frame++) {
    game.phaseFrame = frame; game.interviewRings.length = 0;
    emitMinerva(game, 'interview');
    const expected = (frame - 105) % (frame > 1800 ? period / 2 : period) === 0;
    expect(game.interviewRings).toHaveLength(expected ? 1 : 0);
    if (!expected) continue;
    const ring = game.interviewRings[0];
    expect(Math.sign(ring.spin)).toBe(wave % 2 ? -1 : 1);
    expect(ring.color).toBe(wave % 4);
    expect(ring.speed).toBe(INTERVIEW_SPEED[level]);
    expect(ring.delay).toBe(MINERVA_WARNING[level]);
    wave++;
  }
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('エンドレス・インクワイアリーは%sで下側の定位置を脅かし、60秒間少数の輪だけで動く', (difficulty) => {
  const game = phase(11, difficulty);
  const probes = [24, 108, 192, 276, 360].map((x) => [x, 398]);
  const hits = probes.map(() => false);
  let maxRings = 0;
  for (let frame = 0; frame < 3599; frame++) {
    game.update();
    maxRings = Math.max(maxRings, game.interviewRings.length);
    expect(game.bullets.count).toBe(0);
    for (const ring of game.interviewRings) if (ring.launched) {
      probes.forEach(([x, y], i) => { if (interviewRingDistance(ring, x, y) <= 5.5) hits[i] = true; });
    }
  }
  expect(hits).toEqual(probes.map(() => true));
  expect(maxRings).toBeLessThanOrEqual(6);
});

it('連続した輪は予告中に当たらず、円弧の端まで判定し、穴と無敵中は当たらない', () => {
  const game = phase(11); game.invincible = false; game.invulnFrames = 0;
  game.px = 192; game.py = 398;
  // 発射フレームに合わせる。
  game.phaseFrame = 105; emitMinerva(game, 'interview');
  const ring = game.interviewRings[0];
  Object.assign(ring, { x: 192, y: 223, radius: 175, speed: 0, gap: 0, delay: 1 });
  updateInterviewRings(game); expect(game.pendingHit).toBe(-1);
  ring.gap = Math.PI / 2;
  updateInterviewRings(game); expect(game.pendingHit).toBe(-1);
  const endpoint = ring.gap + ring.opening / 2;
  game.px = ring.x + Math.cos(endpoint) * ring.radius;
  game.py = ring.y + Math.sin(endpoint) * ring.radius;
  game.invincible = true; updateInterviewRings(game); expect(game.pendingHit).toBe(-1);
  game.invincible = false; updateInterviewRings(game); expect(game.pendingHit).toBe(0);
  expect(game.hitDuringSpell).toBe(true);
});

it('輪のかすりは1本につき1回だけ加点し、技の切り替えとステージ開始で輪を消す', () => {
  const game = phase(11); game.invincible = false; game.invulnFrames = 0;
  game.px = 192; game.py = 398; game.phaseFrame = 105;
  emitMinerva(game, 'interview');
  Object.assign(game.interviewRings[0], { x: 192, y: 223, radius: 165, speed: 0, gap: 0, delay: 0 });
  updateInterviewRings(game); updateInterviewRings(game);
  expect(game.graze).toBe(1); expect(game.score).toBe(100); expect(game.pendingHit).toBe(-1);
  game.skipPhase(); expect(game.interviewRings).toHaveLength(0);
  game.startBoss(false, 11); game.phaseFrame = 105; emitMinerva(game, 'interview');
  expect(game.interviewRings).toHaveLength(1);
  game.startStage(1); expect(game.interviewRings).toHaveLength(0);
});

it.each([
  { gap: 0, delay: 0, launched: true, blocked: true },
  { gap: Math.PI / 2, delay: 0, launched: true, blocked: false },
  { gap: 0, delay: 10, launched: false, blocked: false },
])('回廊のシールドは実体を遮り穴と予告を通す: %j', ({ gap, delay, launched, blocked }) => {
  const game = phase(11); game.phaseFrame = 104;
  game.interviewRings.push({ x: 192, y: 132, radius: 100, speed: 0, spin: 0, gap, opening: 0.54, color: 0, delay, launched, grazed: false });
  const shot = game.shots.acquire()!;
  // 1フレームで輪を跨いでボスへ届くショットでも、先に輪へ当たる。
  Object.assign(shot, { x: 192, y: 260, vx: 0, vy: -120, radius: 3, damage: 10, homing: false });
  const hp = game.phaseHp;
  game.update();
  expect(shot.active).toBe(false);
  expect(game.phaseHp).toBe(hp - (blocked ? 0 : 10));
});

it('シールドの丸い端をかするショットも止まり、穴の内側のショットは止まらない', () => {
  const game = phase(11); game.phaseFrame = 105; emitMinerva(game, 'interview');
  const ring = { ...game.interviewRings[0], x: 0, y: 0, radius: 100, gap: Math.PI / 2, opening: Math.PI / 2, delay: 0, launched: true };
  expect(interviewRingBlocksShot(ring, 75, 85, 75, 55, 3)).toBe(true);
  expect(interviewRingBlocksShot(ring, 60, 85, 60, 75, 3)).toBe(false);
  expect(interviewRingBlocksShot(ring, 0, 110, 0, 90, 3)).toBe(false);
  expect(interviewRingBlocksShot(ring, -150, 0, 150, 0, 3)).toBe(true);
  expect(interviewRingBlocksShot(ring, 100, 0, 100, 0, 3)).toBe(true);
});

it('終符は時間が経っても終わらず、HPを削るとクリアになる', () => {
  const game = phase(12);
  for (let i = 0; i < 7200; i++) game.update();
  expect(game.phase?.pattern).toBe('owlDawn');
  expect(game.phase?.duration).toBe(Infinity);
  expect(game.phaseHp).toBeGreaterThan(1);
  game.phaseHp = 0; game.update();
  expect(game.phase).toBeUndefined();
  expect(game.collectionFrames).toBe(180);
});

it('終符の祈りは元の溜めと発散を保ち、星図と交互に繰り返す', () => {
  const game = phase(12);
  const start = 105 + CONSTELLATION_TIME;
  while (game.phaseFrame < start) game.update();
  const position = game.bossXY;
  let bullets = 0;
  for (let i = 1; i < PRAYER_PERIOD; i++) {
    const before = game.bossXY; game.update();
    const step = dawnPrayerStep(game.phaseFrame);
    if (step < PRAYER_CHARGE + PRAYER_FIRE) expect(game.bossXY).toEqual(position);
    expect(Math.hypot(game.bossXY[0] - before[0], game.bossXY[1] - before[1])).toBeLessThan(3);
    const newOrbs = game.bullets.objects.filter(b => b.active && b.age === 1 && b.kind === 'orb');
    if (step < PRAYER_CHARGE || step >= PRAYER_CHARGE + PRAYER_FIRE) expect(newOrbs).toHaveLength(0);
    bullets += newOrbs.length;
    expect(game.dawnStars).toHaveLength(0);
  }
  expect(bullets).toBe(420);
  expect(game.bossXY).not.toEqual(position);
  game.update();
  expect(dawnPrayerStep(game.phaseFrame)).toBe(-1);
  expect(game.dawnStars).toHaveLength(7);
});

it('Lunaticの各スペルを進めても弾プールを飽和させない', () => {
  for (const index of [1, 3, 5, 7, 9, 10, 11, 12]) {
    const game = phase(index, 'lunatic');
    let max = 0;
    for (let frame = 0; frame < 3599; frame++) {
      game.update();
      max = Math.max(max, game.bullets.count);
    }
    expect(max, `phase ${index}`).toBeLessThan(1000);
  }
});

it('全スペルが自機のいる下半分へ届き、下端が常設の安全地帯にならない', () => {
  for (const index of [1, 3, 5, 7, 9, 10, 11, 12]) {
    const game = phase(index);
    let lowerFrames = 0;
    let bottomFrames = 0;
    for (let frame = 0; frame < 1500; frame++) {
      game.update();
      const active = game.bullets.objects.filter((b) => b.active && b.delay === 0 && b.x >= 9 && b.x <= 375).map(({ x, y }) => ({ x, y }));
      for (const ring of game.interviewRings) if (ring.launched) {
        for (let a = ring.gap + ring.opening / 2; a <= ring.gap + Math.PI * 2 - ring.opening / 2; a += Math.PI / 90) {
          const x = ring.x + Math.cos(a) * ring.radius;
          const y = ring.y + Math.sin(a) * ring.radius;
          if (x >= 9 && x <= 375) active.push({ x, y });
        }
      }
      if (active.some((b) => b.y >= 280 && b.y <= 439)) lowerFrames++;
      if (active.some((b) => b.y >= 390 && b.y <= 439)) bottomFrames++;
    }
    expect(lowerFrames, `phase ${index} lower half`).toBeGreaterThan(300);
    expect(bottomFrames, `phase ${index} bottom`).toBeGreaterThan(100);
  }
});

it('七重の輪は収縮後に予告付きで落ち、自機の高さを横切る', () => {
  const game = phase(1);
  game.phaseFrame = 104; game.update();
  const ring = game.bullets.objects.find((b) => b.active && b.motion === 'minervaRing' && b.x < 90)!;
  expect(ring.releaseAt).toBeGreaterThan(ring.delay);
  for (let i = 1; i < ring.releaseAt; i++) game.update();
  expect(ring.motion).toBe('normal');
  expect(ring.vy).toBeGreaterThan(1.5);
});

it('重力とパノプティコンは中央や左右端に止まっている自機にも届く', () => {
  for (const index of [5, 7]) {
    const game = phase(index);
    const hits = [0, 0, 0];
    for (let frame = 0; frame < 3599; frame++) {
      game.update();
      for (const [i, x] of [9, 192, 375].entries()) {
        if (game.bullets.objects.some((b) => b.active && b.delay === 0 && Math.hypot(b.x - x, b.y - 398) <= b.radius + 2.5)) hits[i]++;
      }
    }
    for (const [i, count] of hits.entries()) expect(count, `phase ${index}, position ${i}`).toBeGreaterThan(0);
  }
});
