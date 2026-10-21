import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { CLONE_CHARGE, CLONE_FIRST_CHARGE, CLONE_SPLIT, jinraiCloneScene } from './patterns/jinrai-clone';
import { dawnPrayerStep, PRAYER_CHARGE, PRAYER_PERIOD } from './patterns/minerva-dawn';
import { REPRISE_PREPARE, REPRISES, repriseDifficulty, repriseIndex, repriseView } from './patterns/minerva-reprise';

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
function next(game: Game): void { game.phaseHp -= game.phaseMaxHp * 0.08 + 0.000001; game.update(); }
function prayer(game: Game, ratio = 1): void {
  game.phaseHp = game.phaseMaxHp * ratio; game.phaseFrame = 104; game.update();
  for (let i = 0; i < 3; i++) next(game);
  expect(game.minervaReprise?.prayer).toBe(true);
}

it.each(difficulties)('再演10種類は%sで元の仕掛けを動かし、8%減少時に全て片付く', difficulty => {
  expect(REPRISES).toHaveLength(10);
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
    if (source.phase.pattern !== 'jinraiClone') expect(maxMove, source.phase.name).toBeLessThan(8);
    expect(bullets + lasers + nodes, source.phase.name).toBeGreaterThan(0);
    if (source.phase.pattern === 'link') expect(nodes).toBeGreaterThan(15);
    next(game);
    expect(game.minervaReprise?.cycle).toBe(1);
    expect(game.bullets.count).toBe(0); expect(game.graphNodes).toHaveLength(0); expect(game.jinraiLasers).toHaveLength(0);
    vi.restoreAllMocks();
  }
});

it('抽選はHP切替ごとに行い、同じ技の連続も選べる。時間やボムでは切り替えない', () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.01);
  const game = fight(); game.phaseFrame = 104; game.update();
  const first = game.minervaReprise;
  game.phaseHp -= game.phaseMaxHp * 0.079; game.bombFrames = 20;
  for (let i = 0; i < 1500; i++) { game.update(); expect(game.minervaReprise).toBe(first); }
  game.phaseHp -= game.phaseMaxHp * 0.002; game.update();
  expect(game.minervaReprise?.cycle).toBe(1); expect(game.minervaReprise?.index).toBe(0);
  random.mockReturnValue(0.999); next(game);
  expect(game.minervaReprise?.index).toBe(9);
  expect(game.minervaReprise?.seen).toEqual([0, 9]);
  game.startBoss(false, 9); expect(game.minervaReprise).toBeUndefined();
});

it('未登場は登場済みの4倍で選び、全10技を候補に保つ', () => {
  const counts = Array<number>(10).fill(0);
  for (let sample = 0; sample < 3700; sample++) counts[repriseIndex([0], (sample + 0.5) / 3700)]++;
  expect(counts).toEqual([100, ...Array<number>(9).fill(400)]);
  for (const seen of [[], Array.from({ length: 10 }, (_, i) => i)]) {
    expect(Array.from({ length: 10 }, (_, i) => repriseIndex(seen, (i + 0.5) / 10))).toEqual(Array.from({ length: 10 }, (_, i) => i));
  }
});

it('祈りでは登場履歴を増やさず、最終技やステージのやり直しで履歴を消す', () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  const choose = (roll: number) => { random.mockReturnValueOnce(roll).mockReturnValueOnce(0.5); };
  const game = fight(); game.phaseFrame = 104;
  choose(0); game.update(); choose(0.999); next(game); choose(0.01); next(game);
  expect(game.minervaReprise?.seen).toEqual([0, 9]);
  next(game);
  expect(game.minervaReprise?.prayer).toBe(true);
  expect(game.minervaReprise?.seen).toEqual([0, 9]);
  choose(0.5); next(game);
  expect(game.minervaReprise?.cycle).toBe(4);
  expect(game.minervaReprise?.seen).toEqual([0, 9, 5]);
  game.startBoss(false, 10); expect(game.minervaReprise).toBeUndefined();
  game.phaseFrame = 104; game.update(); expect(game.minervaReprise?.seen).toEqual([5]);
  game.startStage(5); expect(game.minervaReprise).toBeUndefined();
});

it('再演候補を指定の10技に絞る', () => {
  expect(REPRISES.map(source => source.phase.pattern)).toEqual([
    'vim', 'enter', 'link', 'sweep', 'type', 'grid', 'jinraiKiss', 'jinraiSakura', 'jinraiClone', 'jinraiPetal',
  ]);
});

it('花影は召喚後に二身・三身へ分かれ、どの分身も共有HPへ通常の2/3のダメージを受ける', () => {
  const index = REPRISES.findIndex(source => source.phase.pattern === 'jinraiClone');
  vi.spyOn(Math, 'random').mockReturnValue((index + 0.5) / REPRISES.length);
  const game = fight(); game.phaseFrame = 104; game.update();
  expect(game.bossTargets()).toEqual([game.bossXY]);
  const start = game.minervaReprise!.startFrame + REPRISE_PREPARE - CLONE_FIRST_CHARGE;
  for (const [frame, count] of [[CLONE_FIRST_CHARGE + 30, 1], [CLONE_FIRST_CHARGE + CLONE_CHARGE + CLONE_SPLIT + 60, 2], [2400 + CLONE_CHARGE + CLONE_SPLIT + 60, 3]]) {
    game.phaseFrame = start + frame;
    const scene = jinraiCloneScene(frame, 60);
    expect(game.bossTargets()).toHaveLength(count);
    expect(game.bossXY).toEqual([scene.bodies[0].x, scene.bodies[0].y]);
    for (const body of scene.bodies) {
      const hp = game.phaseHp, shot = game.shots.acquire()!;
      Object.assign(shot, { x: body.x, y: body.y, vx: 0, vy: 0, radius: 3, damage: 30, homing: false });
      game.update(); expect(hp - game.phaseHp).toBeCloseTo(20); expect(shot.active).toBe(false);
    }
  }
  next(game); expect(game.bossTargets()).toEqual([game.bossXY]);
});

it.each(difficulties)('花影の%sはPower4で撃ち続けてもHP切替前に二身の射撃まで見せる', difficulty => {
  const index = REPRISES.findIndex(source => source.phase.pattern === 'jinraiClone');
  vi.spyOn(Math, 'random').mockReturnValue((index + 0.5) / REPRISES.length);
  const game = fight('owlDawn', difficulty); game.phaseFrame = 104; game.autoshot = true; game.power = 4;
  let twoFired = false, praying = false;
  for (let frame = 0; frame < 1800 && (game.minervaReprise?.cycle ?? 0) === 0; frame++) {
    game.px = game.bossXY[0]; game.update();
    if (game.minervaReprise?.cycle !== 0) break;
    const attack = repriseView(game), scene = jinraiCloneScene(attack.phaseFrame, attack.phase!.duration);
    praying ||= scene.charging;
    twoFired ||= scene.bodies.length === 2 && game.bullets.count > 0;
  }
  expect(praying).toBe(true); expect(twoFired).toBe(true); expect(game.minervaReprise?.cycle).toBe(1);
});

it('HP8%ごとに再演3回と4回の後へ祈りを挟み、祈りもHPで終わる', () => {
  const game = fight(); game.phaseFrame = 104; game.update();
  for (let cycle = 0; cycle <= 12; cycle++) {
    expect(game.minervaReprise?.cycle).toBe(cycle);
    expect(game.minervaReprise?.prayer).toBe(cycle % 9 === 3 || cycle % 9 === 8);
    if (game.minervaReprise?.prayer) {
      for (let i = 0; i < PRAYER_PERIOD * 2; i++) game.update();
      expect(game.minervaReprise.cycle).toBe(cycle);
      expect(dawnPrayerStep(game.phaseFrame, game.minervaReprise)).toBe(0);
    }
    if (cycle < 12) next(game);
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
