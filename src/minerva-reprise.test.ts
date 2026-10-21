import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { dawnPrayerStep, PRAYER_CHARGE, PRAYER_PERIOD } from './patterns/minerva-dawn';
import { REPRISE_PREPARE, REPRISES, repriseDifficulty, repriseView } from './patterns/minerva-reprise';

const difficulties = ['easy', 'normal', 'hard', 'lunatic'] as const;
let keydown: (event: { code: string; repeat: boolean; preventDefault: () => void }) => void;
beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof keydown) => { if (kind === 'keydown') keydown = listener; } });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function fight(pattern = 'owlDawn', difficulty: Game['difficulty'] = 'normal'): Game {
  const game = new Game(); game.audio.volume = 0; game.difficulty = difficulty;
  game.startStage(5); game.startBoss(false, 10); game.invincible = true;
  if (pattern !== 'owlDawn') {
    const index = pattern === 'recall' ? 7 : 9;
    game.startBoss(false, index);
  }
  return game;
}
function next(game: Game): void { game.phaseHp -= game.phaseMaxHp * 0.05 + 0.000001; game.update(); }
function prayer(game: Game, ratio = 1): void {
  game.phaseHp = game.phaseMaxHp * ratio; game.phaseFrame = 104; game.update();
  for (let i = 0; i < 3; i++) next(game);
  expect(game.minervaReprise?.prayer).toBe(true);
}

it.each(difficulties)('再演12種類は%sで元の仕掛けを動かし、5%減少時に全て片付く', difficulty => {
  expect(REPRISES).toHaveLength(12);
  expect(new Set(REPRISES.map(source => source.boss)).size).toBe(4);
  for (const [index, source] of REPRISES.entries()) {
    vi.spyOn(Math, 'random').mockReturnValue((index + 0.5) / REPRISES.length);
    const game = fight('owlDawn', difficulty); game.phaseFrame = 104;
    const actualPhase = game.phase;
    let bullets = 0, lasers = 0, nodes = 0, maxMove = 0;
    let previous = game.bossXY;
    for (let local = 0; local < REPRISE_PREPARE + 1200; local++) {
      game.update();
      expect(game.phase).toBe(actualPhase); expect(game.boss).toBe('minerva');
      expect(game.phase?.duration).toBe(Infinity); expect(game.minervaReprise?.cycle).toBe(0);
      expect(game.minervaReprise?.index).toBe(index);
      const position = game.bossXY;
      maxMove = Math.max(maxMove, Math.hypot(position[0] - previous[0], position[1] - previous[1])); previous = position;
      bullets = Math.max(bullets, game.bullets.count); lasers = Math.max(lasers, game.jinraiLasers.length); nodes = Math.max(nodes, game.graphNodes.length);
      expect(game.bullets.count, source.phase.name).toBeLessThan(1000);
      game.bullets.forEach(b => { expect(Number.isFinite(b.x) && Number.isFinite(b.y), source.phase.name).toBe(true); });
      if (local < REPRISE_PREPARE) expect(game.bullets.count).toBe(0);
    }
    expect(maxMove, source.phase.name).toBeLessThan(8);
    expect(bullets + lasers + nodes, source.phase.name).toBeGreaterThan(0);
    if (source.phase.pattern === 'link') expect(nodes).toBeGreaterThan(15);
    if (source.phase.pattern === 'jinraiLaser') expect(lasers).toBeGreaterThan(0);
    next(game);
    expect(game.minervaReprise?.cycle).toBe(1);
    expect(game.bullets.count).toBe(0); expect(game.graphNodes).toHaveLength(0); expect(game.jinraiLasers).toHaveLength(0);
    vi.restoreAllMocks();
  }
});

it('抽選はHP切替ごとに独立し、同じ技の連続も選べる。時間やボムでは切り替えない', () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.01);
  const game = fight(); game.phaseFrame = 104; game.update();
  const first = game.minervaReprise;
  game.phaseHp -= game.phaseMaxHp * 0.049; game.bombFrames = 20;
  for (let i = 0; i < 1500; i++) { game.update(); expect(game.minervaReprise).toBe(first); }
  game.phaseHp -= game.phaseMaxHp * 0.002; game.update();
  expect(game.minervaReprise?.cycle).toBe(1); expect(game.minervaReprise?.index).toBe(0);
  random.mockReturnValue(0.999); next(game);
  expect(game.minervaReprise?.index).toBe(11);
  game.startBoss(false, 9); expect(game.minervaReprise).toBeUndefined();
});

it('HP5%ごとに再演3回と4回の後へ祈りを挟み、祈りもHPで終わる', () => {
  const game = fight(); game.phaseFrame = 104; game.update();
  for (let cycle = 0; cycle < 19; cycle++) {
    expect(game.minervaReprise?.cycle).toBe(cycle);
    expect(game.minervaReprise?.prayer).toBe(cycle % 9 === 3 || cycle % 9 === 8);
    if (game.minervaReprise?.prayer) {
      for (let i = 0; i < PRAYER_PERIOD * 2; i++) game.update();
      expect(game.minervaReprise.cycle).toBe(cycle);
      expect(dawnPrayerStep(game.phaseFrame, game.minervaReprise)).toBe(0);
    }
    next(game);
  }
});

it.each(difficulties)('再演の%sだけ1段階上げ、本体の難易度と祈りは変えない', difficulty => {
  const game = fight('owlDawn', difficulty); game.phaseFrame = 104; game.update();
  expect(repriseView(game).difficulty).toBe(repriseDifficulty(difficulty)); expect(game.difficulty).toBe(difficulty);
  next(game); next(game); next(game);
  expect(repriseView(game)).toBe(game); expect(repriseView(game).difficulty).toBe(difficulty);
});

it('召喚中はダメージを受けず、最終技のショットとボムのダメージだけ2/3になる', () => {
  function hit(game: Game): number {
    const [x, y] = game.bossXY, hp = game.phaseHp, shot = game.shots.acquire()!;
    Object.assign(shot, { x, y, vx: 0, vy: 0, radius: 3, damage: 30, homing: false }); game.update(); return hp - game.phaseHp;
  }
  const entering = fight(); entering.phaseFrame = 50;
  expect(hit(entering)).toBeCloseTo(20);
  const game = fight(); game.phaseFrame = 104; game.update();
  expect(hit(game)).toBe(0);
  game.phaseFrame = game.minervaReprise!.startFrame + REPRISE_PREPARE;
  expect(hit(game)).toBeCloseTo(20);
  const hp = game.phaseHp;
  keydown({ code: 'KeyX', repeat: false, preventDefault() {} }); game.update();
  expect(hp - game.phaseHp).toBeCloseTo(24);
  const ordinary = fight('interview'); ordinary.phaseFrame = 200;
  expect(hit(ordinary)).toBeCloseTo(30);
});

it('HP半分以下の祈りは途中から逆回転の星弾も出し、前半は追加しない', () => {
  for (const ratio of [1, 0.65]) {
    const game = fight(); prayer(game, ratio);
    while (dawnPrayerStep(game.phaseFrame, game.minervaReprise) < PRAYER_CHARGE + 72) {
      game.update();
      if (dawnPrayerStep(game.phaseFrame, game.minervaReprise) < PRAYER_CHARGE + 72) expect(game.bullets.objects.some(b => b.active && b.kind === 'star')).toBe(false);
    }
    const added = game.bullets.objects.filter(b => b.active && b.kind === 'star');
    expect(added).toHaveLength(ratio === 0.65 ? 7 : 0);
    if (added.length) expect(added[0].vx).toBeCloseTo(Math.cos(Math.PI / 2 - 72 * 0.027 + Math.PI / 7) * 2.7);
  }
});

it('再演中も本体のHPと時計を保ち、リターンのショット反射が働く', () => {
  const index = REPRISES.findIndex(s => s.phase.pattern === 'enter');
  vi.spyOn(Math, 'random').mockReturnValue((index + 0.5) / REPRISES.length);
  const game = fight(); game.phaseFrame = 104; game.update();
  const view = repriseView(game);
  expect(view.phase?.pattern).toBe('enter'); expect(game.phase?.pattern).toBe('owlDawn');
  expect(view.phaseFrame).toBe(105 - REPRISE_PREPARE); expect(game.phaseFrame).toBe(105);
  game.phaseFrame = 400; game.bullets.clear();
  const letter = game.spawnBullet(192, 280, 0, 0, 1, 'glyph')!;
  letter.motion = 'enterLine'; letter.delay = 0; letter.radius = 4;
  const shot = game.shots.acquire()!; Object.assign(shot, { x: 192, y: 290, vx: 0, vy: -20, damage: 2, radius: 3, homing: false });
  const hp = game.phaseHp; game.update(); expect(shot.active).toBe(false); expect(game.phaseHp).toBe(hp);
  expect(game.bullets.objects.some(b => b.active && b.kind === 'needle')).toBe(true);
});

it.each(difficulties)('リトラクションは%sで全弾が画面外へ出てから本体に帰る', difficulty => {
  const game = fight('recall', difficulty); game.phaseFrame = 104; game.update();
  const bullets = game.bullets.objects.filter(b => b.active && b.motion === 'recall'); const outside = new Set<object>();
  while (bullets.some(b => b.active)) {
    game.update();
    for (const b of bullets) if (b.active && b.age >= b.gridRow && b.age < b.releaseAt) {
      expect(b.x < 0 || b.x > 384 || b.y < 0 || b.y > 448).toBe(true); outside.add(b);
    }
    for (const b of bullets) if (!b.active) {
      expect(b.age).toBeLessThan(b.fadeAt); expect(Math.hypot(b.x - b.targetX, b.y - b.targetY)).toBeLessThanOrEqual(b.sway);
    }
  }
  expect(outside.size).toBe(bullets.length);
});

it.each([[0.01, 'life'], [0.10, 'bomb'], [0.31, undefined]] as const)('祈りの抽選%sでは%sを混ぜ、HP区間が長引いても最大1個だけ放出する', (roll, kind) => {
  vi.spyOn(Math, 'random').mockReturnValue(roll);
  const game = fight(); prayer(game);
  const spawn = vi.spyOn(game, 'spawnItem'), start = game.phaseFrame;
  while (game.phaseFrame < start + PRAYER_CHARGE + 72) game.update();
  const items = game.items.objects.filter(item => item.active && (item.kind === 'life' || item.kind === 'bomb'));
  expect(items).toHaveLength(kind ? 1 : 0);
  if (kind) { expect(items[0].kind).toBe(kind); expect(items[0].vy).toBeGreaterThan(0); expect(items[0].manual).toBe(true); }
  while (game.phaseFrame < start + PRAYER_PERIOD * 3) game.update();
  expect(spawn.mock.calls.filter(([, , item]) => item === 'bomb' || item === 'life')).toHaveLength(kind ? 1 : 0);
});

it('HP後半でも補給でき、ボム中に抽選時点を過ぎても後で放出しない', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.10);
  for (const bombFrames of [0, 20]) {
    const game = fight(); prayer(game, 0.65);
    game.phaseFrame = game.minervaReprise!.startFrame + PRAYER_CHARGE + 71; game.bombFrames = bombFrames; game.update();
    expect(game.items.objects.filter(item => item.active && item.kind === 'bomb')).toHaveLength(bombFrames ? 0 : 1);
    if (bombFrames) {
      for (let i = 0; i < PRAYER_PERIOD * 2; i++) game.update();
      expect(game.items.objects.some(item => item.active && item.kind === 'bomb')).toBe(false);
    }
  }
});
