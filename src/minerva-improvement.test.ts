import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { INTERVIEW_PERIOD, MINERVA_WARNING } from './patterns/minerva';
import { STAR_FLIGHT_TIME, starFlightPoint } from './patterns/minerva-flight';

const difficulties = ['easy', 'normal', 'hard', 'lunatic'] as const;
beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function fight(index: number, difficulty: Game['difficulty']): Game {
  const game = new Game(); game.audio.volume = 0; game.difficulty = difficulty;
  game.startStage(5); game.startBoss(false, index); game.invincible = true;
  return game;
}

it.each(difficulties)('サーベイの%sは七重の輪を保って解放し、広い縦通路を作らない', (difficulty) => {
  const game = fight(1, difficulty); game.phaseFrame = 104; game.update();
  const rings = game.bullets.objects.filter(b => b.active && b.motion === 'minervaRing');
  expect(new Set(rings.map(b => b.color)).size).toBe(4);
  expect(rings.some(b => Math.abs(b.x - 192) < 24)).toBe(true);
  const release = rings[0].releaseAt;
  while (rings[0].age < release - 1) game.update();
  const positions = rings.map(b => [b.x, b.y]);
  game.update();
  const fall = [1.25, 1.65, 1.95, 2.25][difficulties.indexOf(difficulty)];
  rings.forEach((b, i) => {
    const angle = Math.atan2(positions[i][1] - 220, positions[i][0] - 192);
    expect(b.motion).toBe('normal');
    expect(b.vx).toBeCloseTo(Math.cos(angle) * 0.55);
    expect(b.vy).toBeCloseTo(fall + Math.sin(angle) * 0.55);
  });
});

it.each(difficulties)('サーベイの両端とパノプティコンの下半分は%sで1px刻みの固定点にも弾が届く', (difficulty) => {
  for (const index of [1, 7]) {
    const game = fight(index, difficulty);
    const rows = [320, 398, 430];
    const touched = rows.map(() => new Set<number>());
    for (let frame = 0; frame < 3598; frame++) {
      game.update();
      game.bullets.forEach(b => {
        if (b.delay > 0) return;
        const radius = 2.5 + b.radius;
        for (const [row, y] of rows.entries()) {
          const dy = b.y - y;
          if (Math.abs(dy) > radius) continue;
          const width = Math.sqrt(radius ** 2 - dy ** 2);
          for (let x = Math.max(9, Math.ceil(b.x - width)); x <= Math.min(375, Math.floor(b.x + width)); x++) touched[row].add(x);
        }
      });
    }
    for (const [row, y] of rows.entries()) {
      const untouched = Array.from({ length: 367 }, (_, i) => i + 9).filter(x => !touched[row].has(x));
      expect(untouched, `phase ${index}, y ${y}`).toEqual([]);
    }
  }
});

it.each(difficulties)('リトラクションの%sは下半分まで進み、一拍止まって同じ原点へ連続的に戻る', (difficulty) => {
  const game = fight(9, difficulty); game.phaseFrame = 104; game.update();
  const bullet = game.bullets.objects.filter(b => b.active && b.motion === 'recall' && b.vy > 0)
    .sort((a, b) => b.vy * b.gridRow - a.vy * a.gridRow)[0];
  const origin = [bullet.targetX, bullet.targetY];
  while (bullet.age < bullet.gridRow) game.update();
  expect(bullet.y).toBeGreaterThan(390);
  const stop = [bullet.x, bullet.y];
  while (bullet.age < bullet.releaseAt - 1) {
    game.update(); expect([bullet.x, bullet.y]).toEqual(stop);
  }
  let previousDistance = Math.hypot(bullet.x - origin[0], bullet.y - origin[1]);
  while (bullet.active) {
    const before = [bullet.x, bullet.y]; game.update();
    expect(Math.hypot(bullet.x - before[0], bullet.y - before[1])).toBeLessThanOrEqual(bullet.sway + 0.001);
    const distance = Math.hypot(bullet.x - origin[0], bullet.y - origin[1]);
    expect(distance).toBeLessThanOrEqual(previousDistance + 0.001);
    expect([bullet.targetX, bullet.targetY]).toEqual(origin);
    previousDistance = distance;
  }
  expect(previousDistance).toBeLessThanOrEqual(bullet.sway);
});

it.each(difficulties)('フライトの%sはHPで早く増員し、段階を保持し、3羽への切替を最低2秒空ける', (difficulty) => {
  const game = fight(10, difficulty); game.phaseFrame = 104; game.update();
  const first = game.bullets.objects.find(b => b.active && b.motion === 'starOwl')!;
  game.phaseHp = game.phaseMaxHp * 0.3; game.update();
  expect(game.minervaFlightPairStart).toBe(106);
  expect(game.minervaFlightThirdStart).toBe(-1);
  expect(first.active).toBe(true);
  while (game.phaseFrame < 225) game.update();
  expect(game.minervaFlightThirdStart).toBe(-1);
  game.update(); expect(game.minervaFlightThirdStart).toBe(226);
  expect(game.bullets.objects.filter(b => b.active && b.motion === 'starOwl')).toHaveLength(3);
  const third = game.bullets.objects.find(b => b.active && b.motion === 'starOwl' && b.gridColumn === 2)!;
  const middle = starFlightPoint(STAR_FLIGHT_TIME / 2, 192, 126, third.sway, third.gridRow);
  for (const owl of game.bullets.objects.filter(b => b.active && b.motion === 'starOwl' && b !== third)) {
    const other = starFlightPoint(STAR_FLIGHT_TIME / 2, 192, 126, owl.sway, owl.gridRow);
    expect(Math.hypot(middle[0] - other[0], middle[1] - other[1])).toBeGreaterThan(60);
  }
  game.phaseHp = game.phaseMaxHp; game.update();
  expect(game.minervaFlightPairStart).toBe(106); expect(game.minervaFlightThirdStart).toBe(226);
  game.startBoss(false, 10);
  expect(game.minervaFlightPairStart).toBe(-1); expect(game.minervaFlightThirdStart).toBe(-1);
});

it.each(difficulties)('インクワイアリーの%sはHPで早めても輪を連射せず、発射済みの輪と色・回転順を保つ', (difficulty) => {
  const game = fight(11, difficulty); const level = difficulties.indexOf(difficulty);
  game.phaseFrame = 104; game.update();
  const first = game.interviewRings[0]; const opening = first.opening;
  game.phaseHp = game.phaseMaxHp * 0.4; game.update();
  expect(game.minervaInterviewLateStart).toBe(106);
  expect(game.interviewRings).toHaveLength(1);
  game.phaseHp = game.phaseMaxHp;
  const next = 105 + INTERVIEW_PERIOD[level] / 2;
  while (game.phaseFrame < next - 1) game.update();
  expect(game.interviewRings).toHaveLength(1);
  game.update(); expect(game.interviewRings).toHaveLength(2);
  expect(game.interviewRings[0]).toBe(first); expect(first.opening).toBe(opening);
  const second = game.interviewRings[1];
  expect(second.color).toBe(1); expect(second.spin * first.spin).toBeLessThan(0);
  expect(second.delay).toBe(MINERVA_WARNING[level] - 1);
  game.startBoss(false, 11);
  expect(game.minervaInterviewLateStart).toBe(-1); expect(game.minervaInterviewWave).toBe(0);
});

it.each(difficulties)('フライトの%sはボムでHP条件を満たしても増員を捨てず、ボム明けに手元から飛び立つ', (difficulty) => {
  const game = fight(10, difficulty); game.phaseFrame = 104;
  game.phaseHp = game.phaseMaxHp * 0.3; game.bombFrames = 30;
  while (game.bombFrames > 1) {
    game.update();
    expect(game.minervaFlightPairStart).toBe(-1);
    expect(game.bullets.count).toBe(0);
  }
  game.update();
  expect(game.minervaFlightPairStart).toBe(game.phaseFrame);
  expect(game.bullets.objects.filter(b => b.active && b.motion === 'starOwl')).toHaveLength(2);
});

it.each(difficulties)('フライトの%sは遅れて加わった3羽目と次の2羽も異なる道を飛ぶ', (difficulty) => {
  const game = fight(10, difficulty); game.phaseFrame = 104;
  game.phaseHp = game.phaseMaxHp * 0.74; game.update();
  while (game.phaseFrame < 350) game.update();
  game.phaseHp = game.phaseMaxHp * 0.35; game.update();
  const third = game.bullets.objects.find(b => b.active && b.motion === 'starOwl' && b.gridColumn === 2)!;
  expect(third).toBeDefined();
  while (game.phaseFrame < 585) game.update();
  expect(third.active).toBe(true);
  const middle = starFlightPoint(STAR_FLIGHT_TIME / 2, 192, 126, third.sway, third.gridRow);
  const owls = game.bullets.objects.filter(b => b.active && b.motion === 'starOwl');
  expect(owls).toHaveLength(3);
  for (const owl of owls.filter(b => b !== third)) {
    const other = starFlightPoint(STAR_FLIGHT_TIME / 2, 192, 126, owl.sway, owl.gridRow);
    expect(Math.hypot(middle[0] - other[0], middle[1] - other[1])).toBeGreaterThan(60);
  }
});
