import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { dawnPrayerStep, emitMinerva, eyeX, hypothesisBrightness, MINERVA_WARNING, PRAYER_CHARGE, PRAYER_FIRE, PRAYER_PERIOD } from './patterns/minerva';
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
    'dawnFan', 'sevenRings', 'dawnSpiral', 'question', 'dawnFan', 'hypothesis',
    'dawnSpiral', 'owlEye', 'dawnFan', 'recall', 'citation', 'interview', 'owlDawn',
  ]);
});

it('本物の予告だけ脈打ち、Easyほど差と予告時間が大きい', () => {
  expect(MINERVA_WARNING).toEqual([90, 70, 55, 42]);
  for (const level of [0, 1, 2, 3]) {
    expect(hypothesisBrightness(level, true, 8)).toBeGreaterThan(hypothesisBrightness(level, false, 8));
    expect(hypothesisBrightness(level, true, 8)).not.toBe(hypothesisBrightness(level, true, 20));
  }
  expect(hypothesisBrightness(0, true, 8) - hypothesisBrightness(0, false, 8))
    .toBeGreaterThan(hypothesisBrightness(3, true, 8) - hypothesisBrightness(3, false, 8));
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

it('孫引きは2回だけ二分裂して三代目で止まる', () => {
  const game = phase(10);
  game.phaseFrame = 104; game.update();
  const parent = game.bullets.objects.find((b) => b.active && b.motion === 'citation')!;
  parent.age = parent.releaseAt - 1;
  game.update();
  const children = game.bullets.objects.filter((b) => b.active && b.motion === 'citation' && b.gridRow === 1);
  expect(children).toHaveLength(2);
  children[0].age = children[0].releaseAt - 1;
  game.update();
  const grandchildren = game.bullets.objects.filter((b) => b.active && b.motion === 'citation' && b.gridRow === 2);
  expect(grandchildren).toHaveLength(2);
  grandchildren[0].age = grandchildren[0].releaseAt - 1;
  game.update();
  expect(game.bullets.objects.filter((b) => b.active && b.motion === 'citation' && b.gridRow === 3)).toHaveLength(0);
});

it('追うボスは急に自機が近づいても間合いを保つ', () => {
  const game = phase(11);
  for (const [px, py] of [[192, 132], [192, 398], [25, 35], [359, 340]]) {
    game.px = px; game.py = py;
    game.update();
    const [x, y] = game.bossPosition();
    expect(Math.hypot(px - x, py - y)).toBeGreaterThanOrEqual(155);
  }
});

it('インタビューの輪は近いほど濃くなる', () => {
  const near = phase(11);
  near.py = 300; near.phaseFrame = 104; near.update();
  const far = phase(11);
  far.phaseFrame = 104; far.update();
  const nearRing = near.bullets.objects.filter((b) => b.active && b.motion === 'interviewRing');
  const farRing = far.bullets.objects.filter((b) => b.active && b.motion === 'interviewRing');
  expect(nearRing.length).toBeGreaterThan(farRing.length);
  expect(nearRing.every((b) => b.gridRow === 1)).toBe(true);
  expect(farRing.every((b) => b.gridRow === 0)).toBe(true);
});

it('終符の時間切れ直前も編隊が画面内に残る', () => {
  const game = phase(12);
  for (let i = 0; i < 3599; i++) game.update();
  expect(game.phase?.pattern).toBe('owlDawn');
  expect(game.bullets.objects.some((b) => b.active && b.motion === 'wing' && b.x >= 0 && b.x <= 384)).toBe(true);
});

it('終符は残り45秒から後方弾幕を重ね、残り30秒から祈りの後に高速の渦を連射する', () => {
  const game = phase(12);
  const emission = (frame: number) => {
    game.bullets.clear(); game.phaseFrame = frame;
    emitMinerva(game, 'owlDawn');
    return game.bullets.objects.filter((b) => b.active);
  };
  expect(emission(899).some((b) => b.kind === 'needle' && b.vy < 0)).toBe(false);
  const rear = emission(900).filter((b) => b.kind === 'needle');
  expect(rear).toHaveLength(21);
  expect(rear.some((b) => b.vx < 0)).toBe(true);
  expect(rear.some((b) => b.vx > 0)).toBe(true);
  expect(emission(1799).some((b) => b.kind === 'orb')).toBe(false);
  expect(emission(1800).some((b) => b.kind === 'orb')).toBe(false);
  expect(emission(1800 + PRAYER_CHARGE - 1).some((b) => b.kind === 'orb')).toBe(false);
  const first = emission(1800 + PRAYER_CHARGE).filter((b) => b.kind === 'orb');
  expect(first).toHaveLength(7);
  for (const b of first) expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(3);
  expect(first.some((b) => b.vy > 0)).toBe(true);
  const angle = Math.atan2(first[0].vy, first[0].vx);
  const next = emission(1800 + PRAYER_CHARGE + 3).filter((b) => b.kind === 'orb');
  expect(next).toHaveLength(7);
  expect(Math.atan2(next[0].vy, next[0].vx)).not.toBeCloseTo(angle);
  expect(emission(1800 + PRAYER_CHARGE + PRAYER_FIRE).some((b) => b.kind === 'orb')).toBe(false);
  expect(emission(1800 + PRAYER_PERIOD).some((b) => b.kind === 'orb')).toBe(false);
});

it('終符の祈りと連射は停止した位置で続き、休止で移動を再開して6秒ごとに繰り返す', () => {
  const game = phase(12);
  while (game.phaseFrame < 1800) game.update();
  const position = game.bossXY;
  let bullets = 0;
  for (let i = 1; i < PRAYER_PERIOD; i++) {
    const before = game.bossXY;
    game.update();
    const step = dawnPrayerStep(game.phaseFrame);
    if (step < PRAYER_CHARGE + PRAYER_FIRE) expect(game.bossXY).toEqual(position);
    expect(Math.hypot(game.bossXY[0] - before[0], game.bossXY[1] - before[1])).toBeLessThan(3);
    const newOrbs = game.bullets.objects.filter((b) => b.active && b.age === 1 && b.kind === 'orb');
    if (step < PRAYER_CHARGE || step >= PRAYER_CHARGE + PRAYER_FIRE) expect(newOrbs).toHaveLength(0);
    bullets += newOrbs.length;
  }
  expect(bullets).toBe(420);
  expect(game.bossXY).not.toEqual(position);
  game.update();
  const secondPosition = game.bossXY;
  for (let i = 0; i < PRAYER_CHARGE - 1; i++) game.update();
  expect(game.bossXY).toEqual(secondPosition);
  expect(game.bullets.objects.some((b) => b.active && b.age === 1 && b.kind === 'orb')).toBe(false);
  game.update();
  expect(game.bullets.objects.filter((b) => b.active && b.age === 1 && b.kind === 'orb')).toHaveLength(7);
});

it('終符の後方弾幕が上端と左右隅の待機位置へ届く', () => {
  const game = phase(12);
  const probes = [9, 96, 192, 288, 375].flatMap((x) => [12, 48, 84].map((y) => [x, y]));
  const hits = probes.map(() => 0);
  for (let frame = 0; frame < 1800; frame++) {
    game.update();
    for (const [index, [x, y]] of probes.entries()) {
      if (game.bullets.objects.some((b) => b.active && b.kind === 'needle' && Math.hypot(b.x - x, b.y - y) <= b.radius + 2.5)) hits[index]++;
    }
  }
  for (const [index, count] of hits.entries()) expect(count, `position ${probes[index]}`).toBeGreaterThan(0);
});

it('終符は30秒で1羽、45秒で2羽になり、予告の後は画面内のランダムな行き先へ飛ぶ', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.4);
  const game = phase(12);
  for (let i = 0; i < 1799; i++) game.update();
  expect(game.dawnOwls).toHaveLength(0);
  game.update();
  expect(game.dawnOwls).toHaveLength(1);
  const owl = game.dawnOwls[0];
  const origin = [owl.x, owl.y];
  for (let i = 1; i < owl.warning; i++) game.update();
  expect([owl.x, owl.y]).toEqual(origin);
  game.update();
  expect([owl.x, owl.y]).not.toEqual(origin);
  let targetsChanged = 0;
  while (game.phaseFrame < 3599) {
    const before = game.dawnOwls.map((o) => [o.x, o.y, o.targetX, o.targetY]);
    game.update();
    expect(game.dawnOwls).toHaveLength(game.phaseFrame < 2700 ? 1 : 2);
    for (const [i, o] of game.dawnOwls.entries()) {
      expect(o.x).toBeGreaterThanOrEqual(28); expect(o.x).toBeLessThanOrEqual(356);
      expect(o.y).toBeGreaterThanOrEqual(60); expect(o.y).toBeLessThanOrEqual(412);
      if (!before[i]) continue;
      expect(Math.hypot(o.x - before[i][0], o.y - before[i][1])).toBeLessThanOrEqual(1.51);
      if (o.targetY !== before[i][3]) targetsChanged++;
    }
  }
  expect(targetsChanged).toBeGreaterThan(3);
  game.update();
  expect(game.dawnOwls).toHaveLength(0);
});

it('終符の梟は出現予告中に無害で、接触すると被弾し、無敵中は被弾しない', () => {
  const game = phase(12);
  game.invincible = false; game.phaseFrame = 1799;
  game.update();
  const owl = game.dawnOwls[0];
  game.px = owl.x; game.py = owl.y;
  game.bullets.clear(); game.update();
  expect(game.pendingHit).toBe(-1);
  owl.age = owl.warning;
  game.invulnFrames = 30; game.update();
  expect(game.pendingHit).toBe(-1);
  game.invulnFrames = 0; game.update();
  expect(game.pendingHit).toBeGreaterThanOrEqual(0);
  expect(game.hitDuringSpell).toBe(true);
  game.startBoss(false, 11);
  expect(game.dawnOwls).toHaveLength(0);
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
      const active = game.bullets.objects.filter((b) => b.active && b.delay === 0 && b.x >= 9 && b.x <= 375);
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
  const ring = game.bullets.objects.find((b) => b.active && b.motion === 'minervaRing')!;
  expect(ring.releaseAt).toBeGreaterThan(ring.delay);
  for (let i = 1; i < ring.releaseAt; i++) game.update();
  expect(ring.motion).toBe('normal');
  expect(ring.vy).toBeGreaterThan(1.5);
});

it('仮説と梟の目は中央や左右端に止まっている自機にも届く', () => {
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
