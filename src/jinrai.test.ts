import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { emitBossNormal, normalPeriod } from './patterns/boss-normal';
import { emitJinraiPattern } from './patterns/jinrai';
import { jinraiCloneScene } from './patterns/jinrai-clone';
import { bulletSpeed } from './rules';
import { MID_PHASE, STAGES } from './stages';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function phase(index: number): Game {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(4); game.startBoss(false, index);
  game.phaseFrame = 104; game.update();
  return game;
}

it('迅雷の11フェーズへ直行でき、Power 4.00の理論火力で14秒・25秒になる', () => {
  const dps = (2 + Math.floor(4 / 2)) * 1.35 * (60 / 5);
  expect(dps).toBeCloseTo(64.8);
  expect(STAGES[3].phases).toHaveLength(11);
  STAGES[3].phases.forEach((p, index) => {
    vi.stubGlobal('location', { search: `?boss=4&phase=${index}` });
    const game = new Game(); game.audio.volume = 0;
    expect(game.phaseIndex).toBe(index);
    expect(game.phase).toBe(p);
    expect(p.hp / dps).toBeCloseTo(p.spell ? 25 : 14, 0);
    expect(p.duration).toBe(p.spell ? 60 : 40);
    expect(game.debugState).toMatchObject({ phaseRemainingSeconds: p.duration, phaseHpRatio: 1 });
  });
  expect(MID_PHASE.jinrai.hp / dps).toBeCloseTo(18, 1);
  expect(MID_PHASE.jinrai.duration).toBe(45);
});

it('Power 4.00で本体を追いながら撃ち込むと全フェーズを制限時間内に倒せる', () => {
  for (let index = 0; index < STAGES[3].phases.length; index++) {
    const game = new Game(); game.audio.volume = 0; game.invincible = true;
    game.autoshot = true; game.power = 4;
    game.startStage(4); game.startBoss(false, index);
    const duration = STAGES[3].phases[index].duration * 60;
    let elapsed = 0;
    while (elapsed < duration && game.phaseIndex === index) {
      game.px = game.bossXY[0];
      game.update();
      elapsed++;
    }
    expect(game.phaseIndex, `phase ${index}`).toBe(index + 1);
    expect(elapsed, `phase ${index} should end by damage`).toBeLessThan(duration);
  }
});

it('手裏剣は壁で一度跳ね返り、反射時に小弾を出す', () => {
  const game = phase(1);
  const star = game.bullets.objects.find((b) => b.active && b.motion === 'jinraiBounce');
  expect(star).toBeDefined();
  if (!star) return;
  star.delay = 0; star.x = star.vx < 0 ? 9 : 375;
  const before = game.bullets.count;
  game.update();
  expect(star.bounced).toBe(true);
  expect(game.bullets.count).toBeGreaterThan(before);
  expect(star.color).toBe(3);
});

it('簪のレーザーは予告中に無害で、その後に回転する', () => {
  const game = phase(3);
  const laser = game.jinraiLasers[0];
  expect(laser).toBeDefined();
  const angle = laser.angle;
  for (let i = 0; i < laser.warning - 1; i++) game.update();
  expect(laser.angle).toBe(angle);
  game.update();
  expect(laser.angle).toBeGreaterThan(angle);
});

it('落雷は魔法陣の予告後に着弾点から小弾を出す', () => {
  const game = phase(5);
  const mark = game.jinraiMarks[0];
  expect(mark).toBeDefined();
  mark.age = mark.warning - 1;
  game.update();
  expect(game.bullets.count).toBeGreaterThanOrEqual(8);
});

it('夜桜の舞は3色の小判定花びらを散らし、Normalで80〜150発を保つ', () => {
  let seed = 0x5a17c9e3;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  });
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(4); game.startBoss(false, 7);
  expect(game.phase).toMatchObject({ name: '夜桜の舞', pattern: 'jinraiSakura', hp: 1620, duration: 60 });
  const colors = new Set<number>();
  const sways = new Set<number>();
  for (let frame = 1; frame <= 3540; frame++) {
    game.update();
    for (const b of game.bullets.objects) if (b.active) {
      expect(b.kind).toBe('petal');
      expect(b.radius).toBe(2.2);
      colors.add(b.color); sways.add(b.sway);
    }
    if (frame < 360 || frame % 60 !== 0) continue;
    const visible = game.bullets.objects.filter((b) => b.active && b.x >= 0 && b.x <= 384 && b.y >= 0 && b.y <= 448).length;
    expect(visible, `frame ${frame}`).toBeGreaterThanOrEqual(80);
    expect(visible, `frame ${frame}`).toBeLessThanOrEqual(150);
  }
  expect(colors).toEqual(new Set([3, 4, 5]));
  expect(sways.size).toBeGreaterThan(20);
  // 59秒分の全弾を検証するため、CIの実行速度に余裕を持たせる。
}, 20_000);

it('夜桜の舞の突風は予告後90フレーム流し、風下の花びらを渦巻かせる', () => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(4); game.startBoss(false, 7);
  const petal = game.bullets.acquire();
  expect(petal).toBeDefined();
  if (!petal) return;
  Object.assign(petal, { x: 192, y: 220, vx: 0, vy: 1, radius: 2.2, kind: 'petal', motion: 'jinraiSakura', sway: 0, swayRate: 0, swayPhase: 0, rotation: 0, spin: 0, age: 0, delay: 0, fadeAt: 0 });
  game.jinraiWindDirection = 1;
  game.phaseFrame = 104 + 359;
  game.update();
  expect(petal.x).toBe(192);
  game.phaseFrame = 104 + 405;
  game.update();
  expect(petal.x).toBeCloseTo(193.8);
  petal.x = 350;
  game.phaseFrame = 104 + 450;
  const y = petal.y;
  game.update();
  expect(petal.y - y).toBeLessThan(1);
});

it('花吹雪は迅雷を起点として広がり続ける', () => {
  const game = phase(9);
  expect(game.phase?.name).toBe('花吹雪');
  const initial = game.bullets.objects.filter((b) => b.active);
  expect(initial.length).toBeGreaterThanOrEqual(6);
  expect(initial.every((b) => b.kind === 'petal')).toBe(true);
  const angle = Math.atan2(initial[0].vy, initial[0].vx);
  for (let i = 0; i < 60; i++) game.update();
  const minimumAge = Math.min(...game.bullets.objects.filter((b) => b.active).map((b) => b.age));
  const newest = game.bullets.objects.filter((b) => b.active && b.age === minimumAge);
  expect(game.bullets.count).toBeGreaterThan(initial.length);
  expect(newest.length).toBeGreaterThan(0);
  expect(Math.atan2(newest[0].vy, newest[0].vx)).not.toBeCloseTo(angle);
  expect(game.bullets.objects.some((b) => b.active && b.vy < 0)).toBe(true);
  expect(game.bullets.objects.some((b) => b.active && b.vy > 0)).toBe(true);
});

it('花吹雪は難易度が上がるほど螺旋の腕を増やす', () => {
  let previous = 0;
  for (const [index, difficulty] of (['easy', 'normal', 'hard', 'lunatic'] as const).entries()) {
    const game = new Game(); game.audio.volume = 0; game.invincible = true;
    game.difficulty = difficulty; game.startStage(4); game.startBoss(false, 9);
    game.phaseFrame = 104; game.update();
    expect(game.bullets.count, `difficulty ${index}`).toBeGreaterThan(previous);
    previous = game.bullets.count;
  }
});

it('一閃は15秒後に煙で消えて中央へ瞬間移動し、雷と花びらを三連発散して横断へ戻る', () => {
  const game = phase(10);
  const play = vi.spyOn(game.audio, 'play');
  while (game.phaseFrame < 899) game.update();
  const before = game.bossXY;
  game.update();
  expect(game.bossXY).toEqual(before);
  while (game.phaseFrame < 917) game.update();
  expect(game.bossXY).toEqual(before);
  expect(play).toHaveBeenCalledWith('ninpo');
  while (game.phaseFrame < 918) game.update();
  expect(game.bossXY).toEqual([192, 224]);
  const crossing = game.jinraiDashCrossing;
  while (game.phaseFrame < 948) game.update();
  expect(game.jinraiBurstFlashUntil).toBeGreaterThan(game.phaseFrame);
  expect(game.bullets.objects.some((b) => b.active && b.age === 1 && b.kind === 'needle')).toBe(true);
  expect(game.bullets.objects.some((b) => b.active && b.age === 1 && b.kind === 'petal')).toBe(true);
  expect(game.bullets.objects.filter((b) => b.active && b.age === 1)).toHaveLength(56);
  while (game.phaseFrame < 984) game.update();
  expect(play.mock.calls.filter(([sound]) => sound === 'thunderBurst')).toHaveLength(3);
  while (game.phaseFrame < 1020) game.update();
  expect(game.jinraiDashCrossing).toBe(crossing + 1);
  expect(game.jinraiDashTick).toBe(0);
  while (game.phaseFrame < 1380) game.update();
  expect(game.bossXY.every(Number.isFinite)).toBe(true);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('一閃の発散は針も花びらも通常攻撃より気持ち速い: %s', (difficulty) => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.difficulty = difficulty; game.startStage(4); game.startBoss(false, 10);
  while (game.phaseFrame < 948) game.update();
  const speeds = (kind: string) => game.bullets.objects.filter((b) => b.active && b.age === 1 && b.kind === kind).map((b) => Math.hypot(b.vx, b.vy));
  const normal = bulletSpeed(difficulty, 5.1);
  for (const kind of ['needle', 'petal']) {
    expect(Math.min(...speeds(kind)), kind).toBeGreaterThan(normal);
    expect(Math.max(...speeds(kind)), kind).toBeLessThan(normal * 1.15);
  }
});

it('忍術で消えている間はショットが本体のいた場所を通り抜ける', () => {
  const game = phase(10);
  while (game.phaseFrame < 909) game.update();
  const [x, y] = game.bossXY;
  const hp = game.phaseHp;
  const shot = game.shots.acquire()!;
  Object.assign(shot, { x, y, vx: 0, vy: 0, damage: 10, radius: 3, homing: false });
  game.update();
  expect(game.phaseHp).toBe(hp);
  expect(shot.active).toBe(true);
  while (game.phaseFrame < 929) game.update();
  shot.x = 192; shot.y = 224;
  game.update();
  expect(game.phaseHp).toBe(hp - 10);
  expect(shot.active).toBe(false);
});

it('一閃は16px間隔の列に切れ目を作り、停止後に光って時間差で飛ぶ', () => {
  const game = phase(10);
  while (game.jinraiDashTick < 45) game.update();
  const held = game.bullets.objects.filter((b) => b.active && b.motion === 'jinraiHold');
  expect(held).toHaveLength(20);
  expect(held.every((b) => b.y === 115)).toBe(true);
  const positions = held.map((b) => b.x).sort((a, b) => a - b);
  const spacing = positions.slice(1).map((x, i) => x - positions[i]);
  expect(spacing.filter((gap) => gap > 40)).toHaveLength(1);
  expect(spacing.filter((gap) => gap < 40).every((gap) => gap > 14 && gap < 17)).toBe(true);
  while (game.jinraiDashTick < 52) game.update();
  expect(held.every((b) => b.vx === 0 && b.vy === 0)).toBe(true);
  while (game.jinraiDashTick < 62) game.update();
  expect(game.jinraiDashFlashUntil).toBeGreaterThan(game.phaseFrame);
  expect(held.every((b) => b.releaseAt > game.phaseFrame)).toBe(true);
  while (game.jinraiDashTick < 72) game.update();
  expect(held.some((b) => b.motion === 'normal')).toBe(true);
  expect(held.some((b) => b.motion === 'jinraiHold')).toBe(true);
  while (held.some((b) => b.motion === 'jinraiHold')) game.update();
  expect(held.every((b) => b.motion === 'normal')).toBe(true);
});

it('一閃の高さは3段を巡回し、体力半分以下では次の巡回から往復する', () => {
  const game = phase(10);
  expect(game.bossXY[1]).toBe(115);
  game.phaseHp = game.phaseMaxHp / 2;
  while (game.jinraiDashCrossing < 1) game.update();
  expect(game.jinraiDashDouble).toBe(true);
  expect(game.bossXY[1]).toBe(170);
  const firstDirection = game.jinraiDashDirection;
  while (game.jinraiDashCrossing < 2) game.update();
  expect(game.jinraiDashTick).toBe(85);
  expect(game.bossXY[1]).toBe(225);
  expect(game.jinraiDashDirection).toBe(-firstDirection);
  expect(game.bossXY[1]).toBeLessThanOrEqual(398 - 120);
});

it('一閃はNormalの進行中に画面内へ40〜90発を維持する', () => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(4); game.startBoss(false, 10);
  for (let frame = 1; frame <= 720; frame++) {
    game.update();
    if (frame < 240 || frame % 60 !== 0) continue;
    const visible = game.bullets.objects.filter((b) => b.active && b.x >= 0 && b.x <= 384 && b.y >= 0 && b.y <= 448).length;
    expect(visible, `frame ${frame}`).toBeGreaterThanOrEqual(40);
    expect(visible, `frame ${frame}`).toBeLessThanOrEqual(90);
  }
});

it('一閃の後半でもNormalは90発以下に収まり、Lunaticの列にも切れ目が残る', () => {
  const normal = phase(10);
  normal.phaseHp = normal.phaseMaxHp / 2;
  for (let frame = 1; frame <= 600; frame++) {
    normal.update();
    if (frame < 240 || frame % 60 !== 0) continue;
    const visible = normal.bullets.objects.filter((b) => b.active && b.x >= 0 && b.x <= 384 && b.y >= 0 && b.y <= 448).length;
    expect(visible, `frame ${frame}`).toBeGreaterThanOrEqual(40);
    expect(visible, `frame ${frame}`).toBeLessThanOrEqual(90);
  }
  const lunatic = new Game(); lunatic.audio.volume = 0; lunatic.invincible = true;
  lunatic.difficulty = 'lunatic'; lunatic.startStage(4); lunatic.startBoss(false, 10);
  while (lunatic.jinraiDashTick < 37) lunatic.update();
  const positions = lunatic.bullets.objects.filter((b) => b.active && b.dashWave === 0).map((b) => b.x).sort((a, b) => a - b);
  expect(positions).toHaveLength(20);
  expect(positions.slice(1).filter((x, i) => x - positions[i] > 40)).toHaveLength(1);
});

it('中ボスは分身せず、単身から左右にずれた針の扇を二連射する', () => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(4); game.startBoss(true, 0);
  expect(game.phase).toMatchObject({ name: '宵雷の扇', pattern: 'jinraiFan', kind: 'midboss' });
  game.phaseFrame = 104; game.update();
  expect(game.bossTargets()).toHaveLength(1);
  const first = game.bullets.objects.filter((b) => b.active);
  expect(first).toHaveLength(13);
  expect(first.every((b) => b.kind === 'needle')).toBe(true);
  for (let frame = 0; frame < 18; frame++) game.update();
  const second = game.bullets.objects.filter((b) => b.active && b.age === 1);
  expect(second).toHaveLength(13);
  expect(Math.atan2(first[6].vy, first[6].vx)).not.toBeCloseTo(Math.atan2(second[6].vy, second[6].vx));
});

it('花影の3人は全難易度で通常攻撃と同じ針弾を同じタイミングで放つ', () => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    const game = phase(8); game.difficulty = difficulty;
    const beat = normalPeriod(game, 84);
    for (let t = 0; t < beat * 2; t++) {
      game.phaseFrame = 2010 + t;
      game.bullets.clear(); emitJinraiPattern(game, 'jinraiClone', t);
      const actual = game.bullets.objects.filter((b) => b.active).map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, radius: b.radius, kind: b.kind, color: b.color }));
      expect(actual.length % 3).toBe(0);
      for (const [index, origin] of game.bossTargets().entries()) {
        game.bullets.clear(); emitBossNormal(game, 'jinraiRapidFan', t, origin);
        const expected = game.bullets.objects.filter((b) => b.active).map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, radius: b.radius, kind: b.kind, color: b.color }));
        expect(actual.slice(index * expected.length, (index + 1) * expected.length)).toEqual(expected);
      }
    }
  }
});

it('花影はどの分身への命中も共有HPを減らし、被弾後も全員の位置が変わらない', () => {
  const game = phase(8);
  game.phaseFrame = 2010;
  const positions = game.bossTargets();
  const hp = game.phaseHp;
  for (const [index, [x, y]] of positions.entries()) {
    const shot = game.shots.acquire()!;
    Object.assign(shot, { x, y, vx: 0, vy: 0, radius: 3, damage: 10, homing: false });
    game.update();
    expect(game.phaseHp).toBe(hp - (index + 1) * 10);
    expect(shot.active).toBe(false);
    expect(game.bossTargets()).toEqual(positions);
  }
  // 1発が複数人へ重なってもダメージを重複させない。
  const shot = game.shots.acquire()!;
  Object.assign(shot, { x: 192, y: 132, vx: 0, vy: 0, radius: 130, damage: 10, homing: false });
  game.update();
  expect(game.phaseHp).toBe(hp - 40);
});

it('ホーミングは最寄りの分身を狙い、次フェーズでは単身へ戻る', () => {
  const game = phase(8);
  game.phaseFrame = 2010;
  const shot = game.shots.acquire()!;
  Object.assign(shot, { x: 72, y: 230, vx: 0, vy: -8, radius: 3, damage: 1, homing: true });
  game.update();
  expect(shot.vx).toBeCloseTo((86 - 72) / 55);
  game.skipPhase();
  while (game.collectionFrames > 0) game.update();
  expect(game.phase?.pattern).toBe('jinraiPetal');
  expect(game.bossTargets()).toHaveLength(1);
});

it('花影は単身で5秒撃ち、印を結んで溜めたあと2秒かけて二身になる', () => {
  const game = phase(8);
  expect(game.bossTargets()).toEqual([[192, 124]]);
  expect(game.bullets.count).toBe(14);
  game.phaseFrame = 404; game.update();
  expect(game.bullets.count).toBe(0);
  expect(jinraiCloneScene(405).charging).toBe(true);
  expect(game.bossTargets()).toHaveLength(1);
  for (let frame = 406; frame < 615; frame++) {
    game.update(); expect(game.bullets.count).toBe(0);
  }
  const halfway = jinraiCloneScene(555);
  expect(halfway.bodies).toEqual([{ x: 154, y: 133, opacity: 1 }, { x: 230, y: 133, opacity: 0.5 }]);
  game.update();
  expect(game.bossTargets()).toEqual([[116, 142], [268, 142]]);
  expect(game.bullets.count).toBe(28);
});

it('花影は残り30秒で二身の射撃を止め、再び溜めてから三身になる', () => {
  const game = phase(8); game.phaseFrame = 1799; game.update();
  expect(game.bossTargets()).toEqual([[116, 142], [268, 142]]);
  expect(jinraiCloneScene(1800).charging).toBe(true);
  expect(game.bullets.count).toBe(0);
  for (let frame = 1801; frame < 2010; frame++) {
    game.update(); expect(game.bullets.count).toBe(0);
  }
  expect(jinraiCloneScene(1950).bodies).toEqual([{ x: 101, y: 142, opacity: 1 }, { x: 192, y: 124, opacity: 0.5 }, { x: 283, y: 142, opacity: 1 }]);
  game.update();
  expect(game.bossTargets()).toEqual([[86, 142], [192, 124], [298, 142]]);
  expect(game.bullets.count).toBe(42);
});

it('二身で祈っている間も両方への命中を受け付ける', () => {
  const game = phase(8); game.phaseFrame = 1800;
  const hp = game.phaseHp;
  for (const [x, y] of game.bossTargets()) {
    const shot = game.shots.acquire()!;
    Object.assign(shot, { x, y, vx: 0, vy: 0, radius: 3, damage: 10, homing: false });
  }
  game.update();
  expect(game.phaseHp).toBe(hp - 20);
});
