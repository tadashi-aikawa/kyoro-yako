import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { type Bullet, Game } from './game';
import { STAR_FLIGHT_PERIOD, STAR_FLIGHT_TIME, STAR_TRAIL_WARNING, starFlightPoint } from './patterns/minerva-flight';
import { bulletContact, FIELD } from './rules';

const levels = ['easy', 'normal', 'hard', 'lunatic'] as const;
const listeners = new Map<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void>();
beforeEach(() => {
  listeners.clear();
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: (type: string, listener: (event: { code: string; repeat: boolean; preventDefault: () => void }) => void) => listeners.set(type, listener) });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function flight(difficulty: Game['difficulty'] = 'normal'): Game {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.difficulty = difficulty; game.startStage(5); game.startBoss(false, 8);
  return game;
}
function of(game: Game, motion: Bullet['motion']): Bullet[] { return game.bullets.objects.filter((b) => b.active && b.motion === motion); }
function key(code: string): void { listeners.get('keydown')!({ code, repeat: false, preventDefault: () => {} }); }

it('アストラル・フライトへ改名し、手元から出るフクロウ本体は接触しても無害', () => {
  const game = flight(); game.phaseFrame = 104; game.invincible = false; game.invulnFrames = 0;
  const [x, y] = game.bossPosition(); game.px = x + 16; game.py = y - 6;
  game.update();
  expect(game.phase?.name).toBe('アストラル・フライト');
  expect(of(game, 'starOwl')).toHaveLength(1);
  expect(of(game, 'starTrail')).toHaveLength(2);
  expect(game.pendingHit).toBe(-1); expect(game.graze).toBe(0);
});

it('光の軌跡は48フレーム無害で静止し、その後の羽は接触する。発射音は予告後にだけ鳴る', () => {
  const game = flight(); game.phaseFrame = 104; game.update();
  const feather = of(game, 'starTrail').find((b) => b.sway > 0)!;
  game.bullets.forEach((b) => { if (b !== feather) b.active = false; });
  const origin = [feather.x, feather.y];
  const sound = vi.spyOn(game.audio, 'play');
  game.invincible = false; game.invulnFrames = 0; game.px = feather.x; game.py = feather.y;
  for (let i = 1; i < STAR_TRAIL_WARNING; i++) {
    game.update(); expect([feather.x, feather.y]).toEqual(origin); expect(game.pendingHit).toBe(-1);
  }
  expect(sound).not.toHaveBeenCalled();
  game.update();
  expect([feather.x, feather.y]).not.toEqual(origin);
  expect(game.hitDuringSpell).toBe(true); expect(sound).toHaveBeenCalledWith('turn');
});

it('羽は2.4秒を越えて残り、画面外へ自然に出てから消える', () => {
  const game = flight(); game.phaseFrame = 104; game.update();
  const feather = of(game, 'starTrail').find((b) => b.sway > 0)!;
  game.bullets.forEach((b) => { if (b !== feather) b.active = false; });
  while (feather.age < 145) game.update();
  expect(feather.active).toBe(true); expect(feather.fadeAt).toBe(0);
  while (feather.active && feather.age < 1000) game.update();
  expect(feather.active).toBe(false);
  expect(feather.x < -25 || feather.x > FIELD.w + 25 || feather.y < -30 || feather.y > FIELD.h + 25).toBe(true);
});

it('次の飛行が始まっても、画面内の前の周期の羽は残る', () => {
  const game = flight();
  while (game.phaseFrame < 105 + STAR_FLIGHT_PERIOD - 1) game.update();
  const previous = of(game, 'starTrail'); expect(previous.length).toBeGreaterThan(0);
  game.update(); expect(of(game, 'starOwl')).toHaveLength(1);
  expect(previous.some((b) => b.active && b.motion === 'starTrail' && b.age > 1)).toBe(true);
});

it('最初15秒は1羽で、残り45秒ちょうどに2羽が手元を出て異なる道を飛ぶ', () => {
  const game = flight();
  while (game.phaseFrame < 899) {
    game.update();
    expect(of(game, 'starOwl').length).toBeLessThanOrEqual(1);
    expect(of(game, 'starOwl').every((b) => b.gridColumn === 0)).toBe(true);
  }
  const feathers = of(game, 'starTrail'); game.update();
  const owls = of(game, 'starOwl'); expect(owls).toHaveLength(2);
  const [x, y] = game.bossPosition();
  for (const owl of owls) expect([owl.x, owl.y]).toEqual([x + 16, y - 6]);
  expect(owls[1].sway).toBe(-owls[0].sway);
  expect(feathers.some((b) => b.active && b.age > 1)).toBe(true);
  game.update(); expect(owls[0].x).not.toBe(owls[1].x);
});

it('残り20秒ちょうどに3羽目が手元を出て、飛行中の2羽と羽はそのまま残る', () => {
  const game = flight();
  while (game.phaseFrame < 2399) {
    game.update(); expect(of(game, 'starOwl').length).toBeLessThanOrEqual(2);
  }
  const previous = of(game, 'starOwl'); expect(previous).toHaveLength(2);
  const ages = previous.map((b) => b.age), feathers = of(game, 'starTrail');
  game.update(); expect(of(game, 'starOwl')).toHaveLength(3);
  previous.forEach((b, i) => { expect(b.active).toBe(true); expect(b.age).toBe(ages[i] + 1); });
  const third = of(game, 'starOwl').find((b) => b.gridColumn === 2)!;
  const [x, y] = game.bossPosition(); expect([third.x, third.y]).toEqual([x + 16, y - 6]);
  expect(feathers.some((b) => b.active && b.age > 1)).toBe(true);
  // 出発時刻だけをずらして既存の道をなぞるのではなく、曲がり方も変える。
  const middle = starFlightPoint(STAR_FLIGHT_TIME / 2, 192, 126, third.sway, third.gridRow);
  for (const owl of previous) {
    const other = starFlightPoint(STAR_FLIGHT_TIME / 2, 192, 126, owl.sway, owl.gridRow);
    expect(Math.hypot(middle[0] - other[0], middle[1] - other[1])).toBeGreaterThan(60);
  }
  game.update();
  expect(previous.every((b) => Math.hypot(b.x - third.x, b.y - third.y) > 1)).toBe(true);
});

it.each(levels)('%sで飛行は自機に追従せず、発射原点が固定され、下端にも羽が届き、弾数は有界', (difficulty) => {
  const game = flight(difficulty), other = flight(difficulty); other.px = 12; other.py = 20;
  let maxBullets = 0, maxOwls = 0, deepest = 0;
  const origins = new Map<Bullet, [number, number]>();
  const previous = new Map<Bullet, [number, number]>();
  const probes = [24, 108, 192, 276, 360].map((x) => [x, 398]); const hits = probes.map(() => false);
  for (let i = 0; i < 3599; i++) {
    const before = of(game, 'starTrail');
    game.update(); other.update();
    for (const b of before) if (!b.active) expect(b.x < -25 || b.x > FIELD.w + 25 || b.y < -30 || b.y > FIELD.h + 25).toBe(true);
    expect(of(game, 'starOwl').map((b) => [b.x, b.y])).toEqual(of(other, 'starOwl').map((b) => [b.x, b.y]));
    for (const owl of of(game, 'starOwl')) {
      if (!origins.has(owl)) origins.set(owl, [owl.targetX, owl.targetY]);
      expect([owl.targetX, owl.targetY]).toEqual(origins.get(owl));
      expect(owl.x).toBeGreaterThan(24); expect(owl.x).toBeLessThan(360);
      const last = previous.get(owl);
      if (last) expect(Math.hypot(owl.x - last[0], owl.y - last[1])).toBeGreaterThan(0.1);
      previous.set(owl, [owl.x, owl.y]);
    }
    maxBullets = Math.max(maxBullets, game.bullets.count); maxOwls = Math.max(maxOwls, of(game, 'starOwl').length);
    for (const b of of(game, 'starTrail')) {
      expect(Math.hypot(b.vx, b.vy)).toBeGreaterThan(0);
      if (b.delay > 0) continue;
      deepest = Math.max(deepest, b.y);
      probes.forEach(([x, y], index) => { if (bulletContact(x, y, b.x, b.y, b.radius, false) === 'hit') hits[index] = true; });
    }
  }
  expect(maxOwls).toBe(3); expect(maxBullets).toBeLessThan(260); expect(deepest).toBeGreaterThan(398);
  expect(hits.some(Boolean)).toBe(true);
  const path = Array.from({ length: STAR_FLIGHT_TIME }, (_, age) => starFlightPoint(age, 192, 126, 1, 0));
  expect(Math.max(...path.map(([x]) => x)) - Math.min(...path.map(([x]) => x))).toBeGreaterThan(240);
  expect(Math.max(...path.map(([, y]) => y)) - Math.min(...path.map(([, y]) => y))).toBeGreaterThan(200);
});

it('ボムでフクロウと軌跡が消え、ボム中の周期は飛ばし、終了後の次周期で再開する', () => {
  const game = flight(); game.phaseFrame = 104; game.update();
  key('KeyX'); game.update(); game.keys.delete('KeyX');
  expect(game.bombFrames).toBeGreaterThan(0); expect(game.bullets.count).toBe(0);
  game.phaseFrame = 104; game.update(); expect(game.bullets.count).toBe(0);
  game.bombFrames = 0; game.update(); expect(game.bullets.count).toBe(0);
  game.phaseFrame = 105 + STAR_FLIGHT_PERIOD - 1; game.update(); expect(of(game, 'starOwl')).toHaveLength(1);
});

it('ポーズで羽ばたきと予告が止まり、技切替・ステージ開始で発射源ごと消える', () => {
  const game = flight(); game.phaseFrame = 104; game.update();
  const before = game.bullets.objects.filter((b) => b.active).map((b) => [b.age, b.x, b.y, b.delay]);
  key('Escape'); game.update(); game.keys.delete('Escape');
  expect(game.scene).toBe('pause'); for (let i = 0; i < 60; i++) game.update();
  expect(game.bullets.objects.filter((b) => b.active).map((b) => [b.age, b.x, b.y, b.delay])).toEqual(before);
  game.scene = 'stage'; game.skipPhase(); expect(game.bullets.count).toBe(0);
  game.startBoss(false, 8); game.phaseFrame = 104; game.update(); expect(game.bullets.count).toBeGreaterThan(0);
  game.startStage(1); expect(game.bullets.count).toBe(0);
});
