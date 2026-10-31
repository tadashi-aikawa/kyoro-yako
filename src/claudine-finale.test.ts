import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { BLOOM_ATTACK, BLOOM_COUNT, BLOOM_CUTIN, BLOOM_LIFE, BLOOM_OPEN, bloomArena, bloomLayout, bloomOpacity, bloomPoint, bloomPose, FINALE_CHARGE, finaleTime, GRAND_LAUNCH, GRAND_QUIET, GRAND_RISE, LAYOUT_MORPH, LAYOUT_PERIOD, LAYOUT_WARNING } from './patterns/claudine-finale';
import { ULTIMATE_CUTINS, ultimateDuration } from './ultimate-cutin';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => vi.unstubAllGlobals());

function start(difficulty: Game['difficulty'] = 'normal'): Game {
  const game = new Game(); game.audio.volume = 0; game.invincible = true; game.difficulty = difficulty;
  game.startStage(3); game.startBoss(false, 9); game.phaseFrame = BLOOM_OPEN - 1; game.update();
  return game;
}

it('4難易度とも打ち上げの光は無害で、開花後に3層の弾が動き出す', () => {
  for (const [level, difficulty] of (['easy', 'normal', 'hard', 'lunatic'] as const).entries()) {
    const game = start(difficulty);
    for (let i = 0; i < FINALE_CHARGE; i++) game.update();
    const rocket = game.bullets.objects.find((b) => b.active)!;
    expect(rocket.motion).toBe('bloomRocket');
    game.invincible = false; game.invulnFrames = 0;
    game.px = rocket.x; game.py = rocket.y;
    game.update(); expect(game.pendingHit).toBe(-1);
    game.invincible = true;
    while (rocket.active) game.update();
    const sparks = game.bullets.objects.filter((b) => b.active && b.motion === 'bloomSpark');
    expect(sparks).toHaveLength(BLOOM_COUNT[level] * 3);
    const b = sparks[0], before = b.targetX, delay = b.delay;
    for (let i = 0; i < delay; i++) game.update();
    expect(b.targetX).toBe(before);
    game.update(); expect(b.targetX).not.toBe(before);
  }
});

it('4難易度ともショットで通常ダメージが入り、HP0で時間切れ前に取得できる', () => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    const game = start(difficulty);
    game.phaseFrame = BLOOM_ATTACK;
    const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
    expect(game.phase?.duration).toBe(99); expect(game.phaseMaxHp).toBe(2916);
    const hit = (damage: number) => {
      const [x, y] = game.bossXY;
      Object.assign(game.shots.acquire()!, { x, y, vx: 0, vy: 0, damage, radius: 3, homing: false });
      game.update();
    };
    const hp = game.phaseHp; hit(10);
    expect(game.phaseHp).toBe(hp - 10);
    const score = game.score; hit(game.phaseHp); game.update();
    expect(game.phase).toBeUndefined(); expect(game.phaseFrame).toBeLessThan(5940);
    expect(game.score).toBeGreaterThan(score); expect(play).toHaveBeenCalledWith('capture');
    expect(game.transition).toBe('boss-defeat-flash'); expect(game.bullets.count).toBe(0);
  }
});

it('溜めとカットインの最中はショットとボムで開始モーションを飛ばさない', () => {
  const game = start(); game.startBoss(false, 9);
  const hp = game.phaseHp;
  for (const frame of [30, BLOOM_CUTIN + 30, BLOOM_OPEN + 90, BLOOM_ATTACK - 2]) {
    game.phaseFrame = frame;
    game.frame = 9;
    const [x, y] = game.bossXY;
    const shot = game.shots.acquire()!;
    Object.assign(shot, { x, y, vx: 0, vy: 0, damage: hp, radius: 3, homing: false });
    game.bombFrames = 2; game.update();
    expect(game.phaseHp).toBe(hp); expect(game.phase?.pattern).toBe('final');
    expect(shot.active).toBe(false);
  }
  game.phaseFrame = BLOOM_ATTACK; game.frame = 9; game.bombFrames = 2; game.update();
  expect(game.phaseHp).toBeLessThan(hp);
});

it('全ブレイクポイントの変形は滑らかで、静止した自機の相対位置を保つ', () => {
  const game = start(); game.px = 230; game.py = 350;
  for (let index = 0; index < 9; index++) {
    const begin = BLOOM_OPEN + FINALE_CHARGE + index * LAYOUT_PERIOD + LAYOUT_WARNING;
    game.phaseFrame = begin;
    const before = bloomArena(finaleTime(game));
    game.px = before.x + before.w * 0.61; game.py = before.y + before.h * 0.78;
    let last = before;
    for (let frame = 0; frame < LAYOUT_MORPH; frame++) {
      game.update();
      const arena = bloomArena(finaleTime(game));
      expect((game.px - arena.x) / arena.w).toBeCloseTo(0.61, 7);
      expect((game.py - arena.y) / arena.h).toBeCloseTo(0.78, 7);
      expect(Math.abs(arena.x - last.x)).toBeLessThan(1);
      expect(Math.abs(arena.y - last.y)).toBeLessThan(1.1);
      last = arena;
    }
  }
});

it('エリア外へ移動できず、ポーズ中は変形しない。ボム後も次の花火を放つ', () => {
  const game = start();
  game.phaseFrame = 1000; const arena = bloomArena(finaleTime(game));
  game.px = arena.x + 9; game.py = arena.y + arena.h - 9;
  game.keys.add('ArrowLeft'); game.keys.add('ArrowDown'); game.update(); game.keys.clear();
  const after = bloomArena(finaleTime(game));
  expect(game.px).toBeGreaterThanOrEqual(after.x + 9);
  expect(game.py).toBeLessThanOrEqual(after.y + after.h - 9);
  game.scene = 'pause'; const stopped = [game.phaseFrame, game.px, game.py];
  for (let i = 0; i < 30; i++) game.update();
  expect([game.phaseFrame, game.px, game.py]).toEqual(stopped);
  game.scene = 'stage'; game.bullets.clear();
  for (let i = 0; i < 360; i++) game.update();
  expect(game.bullets.objects.some((b) => b.active && b.motion === 'bloomSpark')).toBe(true);
});

it('固定位置・固定サイズで2秒閉眼、カットイン、3秒開眼してから通常モーションへ戻る', () => {
  const game = start(); game.startBoss(false, 9);
  for (let i = 0; i < BLOOM_CUTIN - 1; i++) {
    const before = bloomPose(game)!.closed;
    game.update();
    expect(game.bossXY).toEqual([192, 132]); expect(bloomPose(game)?.size).toBe(64);
    expect(bloomPose(game)!.closed).toBeGreaterThanOrEqual(before);
  }
  expect(game.cutin).toBe(0);
  game.update(); expect(game.cutin).toBe(100);
  expect(bloomPose(game)?.closed).toBe(1);
  game.scene = 'pause'; const stopped = [game.cutin, game.phaseFrame];
  for (let i = 0; i < 120; i++) game.update();
  expect([game.cutin, game.phaseFrame]).toEqual(stopped); game.scene = 'stage';
  for (let i = 0; i < ultimateDuration(ULTIMATE_CUTINS.claudine); i++) game.update();
  expect(game.cutin).toBe(0); expect(bloomPose(game)?.closed).toBe(1);
  for (let i = 0; i < FINALE_CHARGE - 1; i++) {
    const before = bloomPose(game)!.closed; game.update();
    expect(game.bossXY).toEqual([192, 132]); expect(bloomPose(game)?.size).toBe(64);
    expect(bloomPose(game)!.closed).toBeLessThanOrEqual(before);
    expect(game.bullets.count).toBe(0);
  }
  game.update(); expect(game.phaseFrame).toBe(BLOOM_ATTACK);
  expect(bloomPose(game)).toBeUndefined(); expect(game.bullets.count).toBe(1);
  game.startBoss(false, 8); expect(bloomPose(game)).toBeUndefined();
});

it('エリアの周回境界でも枠を瞬間移動させない', () => {
  for (let i = 1; i < 10; i++) {
    const edge = FINALE_CHARGE + i * LAYOUT_PERIOD;
    expect(bloomArena(edge)).toEqual(bloomArena(edge - 1));
  }
});

it('菊花の合間にリングとしだれ柳が現れ、打ち上げ時だけ上昇SEを鳴らす', () => {
  const game = start();
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  const types = new Set<number>();
  let ringIsFlat = false, willowRises = false, willowFalls = false;
  for (let i = 0; i < 1250; i++) {
    game.update();
    for (const b of game.bullets.objects) if (b.active && b.motion === 'bloomSpark') types.add(b.dashWave);
    const ring = game.bullets.objects.filter((b) => b.active && b.motion === 'bloomSpark' && b.dashWave === 1 && b.age <= 1);
    if (ring.length > 20) ringIsFlat = Math.max(...ring.map((b) => Math.abs(b.vx))) > Math.max(...ring.map((b) => Math.abs(b.vy))) * 2;
    const willow = game.bullets.objects.filter((b) => b.active && b.motion === 'bloomSpark' && b.dashWave === 2);
    if (willow.some((b) => b.age <= 1)) willowRises = willow.some((b) => b.age <= 1 && b.vy < -1) && willow.some((b) => b.age <= 1 && b.vx < -1) && willow.some((b) => b.age <= 1 && b.vx > 1);
    if (willow.some((b) => b.age > 160 && b.vy > 0)) willowFalls = true;
  }
  expect([...types].sort()).toEqual([0, 1, 2]);
  expect(ringIsFlat).toBe(true); expect(willowRises).toBe(true); expect(willowFalls).toBe(true);
  expect(play.mock.calls.filter(([sound]) => sound === 'fireworkRise')).toHaveLength(4);
  expect(play.mock.calls.filter(([sound]) => sound === 'fireworkGrandRise')).toHaveLength(1);
  expect(play.mock.calls.filter(([sound]) => sound === 'fireworkBoom')).toHaveLength(1);
  expect(play).not.toHaveBeenCalledWith('turn');
});

it('開花後18フレームと薄れた残光は重なっても無害で、寿命で回収する', () => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) for (const age of [5, 17, 18, 19, 40, 227, 350, BLOOM_LIFE - 33, BLOOM_LIFE - 32, BLOOM_LIFE - 1, BLOOM_LIFE]) {
    const game = start(difficulty); game.phaseFrame = 400; game.bullets.clear();
    game.invincible = false; game.invulnFrames = 0;
    const [x, y] = bloomPoint(bloomArena(finaleTime(game)), 192, 350);
    const b = game.spawnBullet(x, y, 0, 0, 2)!;
    Object.assign(b, { motion: 'bloomSpark', targetX: 192, targetY: 350, age: age - 1, radius: 2.5, delay: Math.max(0, 19 - age), fadeAt: BLOOM_LIFE, swayPhase: 90, launchSoundPending: false });
    game.px = x; game.py = y; game.update();
    expect(game.pendingHit >= 0, `${difficulty}:${age}`).toBe(age >= 19 && age < BLOOM_LIFE - 32);
    expect(b.active).toBe(age < BLOOM_LIFE);
  }
});

it('下端に到達した弾はフェード中も接触し、最下段に居続けられない', () => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    const game = start(difficulty); game.invincible = false; game.invulnFrames = 0;
    const probes = [20, 60, 100, 140, 192, 244, 284, 324, 364], contacts = probes.map(() => 0);
    game.invincible = true;
    for (let i = 0; i < 3400; i++) {
      game.update(); const arena = bloomArena(finaleTime(game));
      for (const [index, x] of probes.entries()) {
        const px = arena.x + x * arena.w / 384, py = arena.y + arena.h - 9;
        if (game.bullets.objects.some((b) => b.active && b.motion === 'bloomSpark' && b.delay <= 0 && b.age < b.fadeAt - Math.max(18, Math.ceil(b.swayPhase * 0.35)) && Math.hypot(px - b.x, py - b.y) <= b.radius + 2.5)) contacts[index]++;
      }
    }
    expect(contacts.filter((n) => n > 0).length, `${difficulty}:${contacts}`).toBeGreaterThanOrEqual(8);
  }
});

it('小花火を止めて一拍置き、大玉の打ち上げから長い柳の光跡へ切り替える', () => {
  const game = start();
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  game.phaseFrame = BLOOM_OPEN + FINALE_CHARGE + GRAND_QUIET - 1;
  for (let i = GRAND_QUIET; i < GRAND_LAUNCH; i++) game.update();
  expect(game.bullets.count).toBe(0);
  expect(play).not.toHaveBeenCalledWith('fireworkRise');
  game.update();
  const source = game.bullets.objects.find((b) => b.active)!;
  expect(source.motion).toBe('bloomRocket'); expect(source.dashWave).toBe(2);
  expect(source.releaseAt).toBe(GRAND_RISE);
  expect(source.targetY).toBe(70);
  expect(play).toHaveBeenCalledWith('fireworkGrandRise');
  for (let i = 0; i < GRAND_RISE + 180; i++) game.update();
  expect(play).toHaveBeenCalledWith('fireworkBoom');
  expect(game.bullets.objects.some((b) => b.active && b.motion === 'bloomSpark' && b.dashWave === 2 && b.vy > 0 && b.vy <= 1)).toBe(true);
  expect(play.mock.calls.filter(([sound]) => sound === 'fireworkRise')).toHaveLength(0);
});

it('変形の前に1.2秒の破線予告を置き、その後でエリアを動かす', () => {
  const from = bloomArena(FINALE_CHARGE);
  for (let t = FINALE_CHARGE; t < FINALE_CHARGE + 72; t++) {
    expect(bloomLayout(t).warning).toBe(true);
    expect(bloomArena(t)).toEqual(from);
  }
  expect(bloomLayout(FINALE_CHARGE + 72).warning).toBe(false);
  expect(bloomArena(FINALE_CHARGE + 73).h).toBeLessThan(from.h);
});

it('ボム中と開花前に終了する時刻には打ち上げも上昇音も出さない', () => {
  const game = start('hard');
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  game.phaseFrame = BLOOM_OPEN + FINALE_CHARGE - 1; game.bombFrames = 100; game.update();
  expect(game.bullets.count).toBe(0);
  expect(play).not.toHaveBeenCalledWith('fireworkRise');
  game.bombFrames = 0; game.phaseFrame = 5899; game.update();
  expect(game.bullets.count).toBe(0);
  expect(play).not.toHaveBeenCalledWith('fireworkRise');
});

it('下端に来た小花火と柳は枠内で減速し、透明度がほぼ0になるまで消えない', () => {
  for (const willow of [false, true]) {
    const game = start();
    if (willow) {
      game.phaseFrame = BLOOM_OPEN + FINALE_CHARGE + GRAND_LAUNCH - 1;
      for (let i = 0; i < GRAND_RISE + 2; i++) game.update();
    }
    const b = willow ? game.bullets.objects.find((b) => b.active && b.motion === 'bloomSpark' && b.dashWave === 2)! : game.spawnBullet(192, 400, 0, 2, 2)!;
    game.bullets.forEach((other) => { if (other !== b) other.active = false; });
    Object.assign(b, { motion: 'bloomSpark', targetX: 192, targetY: 419, age: 150, vx: 0, vy: willow ? 1 : 2, delay: 0, fadeAt: BLOOM_LIFE, swayRate: 0.006, swayPhase: willow ? 150 : 90 });
    let minOpacity = 1;
    for (let frame = 0; b.active && frame < 180; frame++) {
      game.update();
      if (b.active) {
        const arena = bloomArena(finaleTime(game));
        expect(b.y).toBeLessThanOrEqual(arena.y + arena.h - 3);
        minOpacity = Math.min(minOpacity, bloomOpacity(b));
      }
    }
    expect(minOpacity).toBeLessThan(0.02);
    expect(b.active).toBe(false);
  }
});

it('大玉前の休止中にボムを使っても、ボム明けの一拍後に一度だけ打ち上げる', () => {
  for (const step of [450, 470, 599, 600]) {
    const game = start(); const launches: number[] = [];
    vi.spyOn(game.audio, 'play').mockImplementation((sound) => { if (sound === 'fireworkGrandRise') launches.push(game.phaseFrame); });
    game.phaseFrame = BLOOM_OPEN + FINALE_CHARGE + step; game.bombFrames = 150;
    for (let i = 0; i < 150; i++) game.update();
    const endBomb = game.phaseFrame;
    expect(launches).toHaveLength(0);
    for (let i = 0; i < 180; i++) game.update();
    expect(launches).toHaveLength(1);
    expect(launches[0] - endBomb).toBeGreaterThanOrEqual(45);
    expect(launches[0] - endBomb).toBeLessThanOrEqual(49);
    expect(game.bullets.objects.some((b) => b.active && b.motion === 'bloomSpark' && b.dashWave === 2)).toBe(true);
  }
});

it('3回の小花火の斉射ごとにリングが現れ、弾消しとポーズで花火の音源を止める', () => {
  const game = start(); let rings = 0;
  for (let i = 0; i < 3400; i++) {
    game.update();
    if (game.bullets.objects.some((b) => b.active && b.motion === 'bloomSpark' && b.dashWave === 1 && b.gridColumn === 0 && b.gridRow === 0 && b.age === 1)) rings++;
  }
  expect(rings).toBeGreaterThanOrEqual(3);
  const stop = vi.spyOn(game.audio, 'stopFireworks');
  game.clearAttackEffects(); expect(stop).toHaveBeenCalledTimes(1);
  game.scene = 'pause'; game.update(); expect(stop.mock.calls.length).toBeGreaterThan(1);
});

it('消え際の高さが1列へ揃わず、薄くなった柳の先端も無害になる', () => {
  const game = start();
  const sparks = Array.from({ length: 12 }, (_, i) => {
    const b = game.spawnBullet(40 + i * 24, 400, 0, 2, 2)!;
    Object.assign(b, { motion: 'bloomSpark', targetX: b.x, targetY: 419, age: 150, radius: 2.5, fadeAt: BLOOM_LIFE, swayPhase: 90, gridColumn: i, gridRow: i % 3, launchSoundPending: false });
    return b;
  });
  for (let i = 0; i < 70; i++) game.update();
  const heights = sparks.map((b) => b.targetY);
  expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(10);
  expect(heights.every((y) => y >= 423 && y <= 439)).toBe(true);
  game.bullets.clear(); game.phaseFrame = 1000;
  game.invincible = false; game.invulnFrames = 0;
  const [x, y] = bloomPoint(bloomArena(finaleTime(game)), 192, 350);
  const b = game.spawnBullet(x, y, 0, 0, 2)!;
  Object.assign(b, { motion: 'bloomSpark', targetX: 192, targetY: 350, age: 196, fadeAt: 240, swayPhase: 150, radius: 2.5, launchSoundPending: false });
  game.px = x; game.py = y; game.update();
  expect(bloomOpacity(b)).toBeLessThan(0.35);
  expect(game.pendingHit).toBe(-1);
});

it('高い位置で開いたLunaticの大玉は上端で弾や光跡を削らない', () => {
  const game = start('lunatic');
  game.phaseFrame = BLOOM_OPEN + FINALE_CHARGE + GRAND_LAUNCH - 1;
  for (let i = 0; i < GRAND_RISE + 200; i++) game.update();
  expect(game.bullets.objects.filter((b) => b.active && b.motion === 'bloomSpark' && b.dashWave === 2)).toHaveLength(156);
});
