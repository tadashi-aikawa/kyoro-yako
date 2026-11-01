import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { CLONE_CHARGE, CLONE_FIRST_CHARGE, CLONE_SPLIT, jinraiCloneScene } from './patterns/jinrai-clone';
import { dawnPrayerStep, PRAYER_CHARGE, PRAYER_PERIOD } from './patterns/minerva-dawn';
import { REPRISE_PREPARE, REPRISES, repriseDifficulty, repriseIndex, reprisePrepare, repriseView } from './patterns/minerva-reprise';
import { OWL_RELEASE_FRAMES } from './patterns/minerva-summon';

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
function finishAwakening(game: Game): void {
  for (let frame = 0; game.minervaReprise?.finale && frame < 2400; frame++) game.update();
  expect(game.minervaReprise?.finale).toBeUndefined();
}
function next(game: Game): void { finishAwakening(game); game.phaseHp = game.phaseMaxHp * (1 - (game.minervaReprise!.cycle + 1) * 0.075) - 0.000001; game.update(); }
function prayer(game: Game, cycle = 3): void {
  game.phaseFrame = 104; game.update();
  for (let i = 0; i < cycle; i++) next(game);
  expect(game.minervaReprise?.prayer).toBe(true);
}

// 9技を1ケースにまとめるとCIで時間切れになるため、難易度と技ごとに検証する。
it.each(difficulties.flatMap(difficulty => REPRISES.map((source, index) => ({ difficulty, pattern: source.phase.pattern, source, index }))))('借りる技 $pattern は $difficulty で元の仕掛けを動かし、HP境界で全て片付く', ({ difficulty, source, index }) => {
  vi.spyOn(Math, 'random').mockReturnValue((index + 0.5) / REPRISES.length);
  const game = fight('owlDawn', difficulty); game.phaseFrame = 104;
  const actualPhase = game.phase;
  let bullets = 0, lasers = 0, nodes = 0, maxMove = 0;
  let previous = game.bossXY;
  for (let local = 0; local < OWL_RELEASE_FRAMES + REPRISE_PREPARE + 1200; local++) {
    game.update();
    expect(game.phase).toBe(actualPhase); expect(game.boss).toBe('minerva');
    expect(game.phase?.duration).toBe(Infinity); expect(game.minervaReprise?.cycle).toBe(0);
    expect(game.minervaReprise?.index).toBe(index);
    const position = game.bossXY;
    maxMove = Math.max(maxMove, Math.hypot(position[0] - previous[0], position[1] - previous[1])); previous = position;
    bullets = Math.max(bullets, game.bullets.count); lasers = Math.max(lasers, game.jinraiLasers.length); nodes = Math.max(nodes, game.graphNodes.length);
    expect(game.bullets.count, source.phase.name).toBeLessThan(1000);
    game.bullets.forEach(b => { expect(Number.isFinite(b.x) && Number.isFinite(b.y), source.phase.name).toBe(true); });
    if (local < reprisePrepare(game.minervaReprise!)) expect(game.bullets.count).toBe(0);
  }
  if (source.phase.pattern !== 'jinraiClone') expect(maxMove, source.phase.name).toBeLessThan(8);
  expect(bullets + lasers + nodes, source.phase.name).toBeGreaterThan(0);
  if (source.phase.pattern === 'link') expect(nodes).toBeGreaterThan(15);
  next(game);
  expect(game.minervaReprise?.cycle).toBe(1);
  expect(game.bullets.count).toBe(0); expect(game.graphNodes).toHaveLength(0); expect(game.jinraiLasers).toHaveLength(0);
}, 10_000);

it('抽選はHP切替ごとに行い、ごく低確率の連続も選べる。時間やボムでは切り替えない', () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0);
  const game = fight(); game.phaseFrame = 104; game.update();
  const first = game.minervaReprise;
  game.phaseHp -= game.phaseMaxHp * 0.074; game.bombFrames = 20;
  for (let i = 0; i < 1500; i++) { game.update(); expect(game.minervaReprise).toBe(first); }
  game.phaseHp -= game.phaseMaxHp * 0.002; game.update();
  expect(game.minervaReprise?.cycle).toBe(1); expect(game.minervaReprise?.index).toBe(0);
  random.mockReturnValue(0.999); next(game);
  expect(game.minervaReprise?.index).toBe(8);
  expect(game.minervaReprise?.seen).toEqual([0, 0, 8]);
  game.startBoss(false, 9); expect(game.minervaReprise).toBeUndefined();
});

it.each([
  { seen: [0, 1], expected: [100, 1, ...Array<number>(7).fill(10000)] },
  { seen: [3, 7, 3], expected: [10000, 10000, 10000, 1, 10000, 10000, 10000, 100, 10000] },
])('履歴$seenから未登場・登場済み・直前を10000:100:1で選ぶ', ({ seen, expected }) => {
  const counts = Array<number>(9).fill(0), total = 70101;
  for (let sample = 0; sample < total; sample++) counts[repriseIndex(seen, (sample + 0.5) / total)]++;
  expect(counts).toEqual(expected);
});

it('初回は均等に選び、全9技が登場した後も直前の技だけを100分の1に抑える', () => {
  expect(Array.from({ length: 9 }, (_, i) => repriseIndex([], (i + 0.5) / 9))).toEqual(Array.from({ length: 9 }, (_, i) => i));
  const seen = Array.from({ length: 9 }, (_, i) => i), counts = Array<number>(9).fill(0);
  for (let sample = 0; sample < 801; sample++) counts[repriseIndex(seen, (sample + 0.5) / 801)]++;
  expect(counts).toEqual([...Array<number>(8).fill(100), 1]);
});

it('祈りでは登場履歴を増やさず、最終技やステージのやり直しで履歴を消す', () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  const choose = (roll: number) => { random.mockReturnValueOnce(roll).mockReturnValueOnce(0.5); };
  const game = fight(); game.phaseFrame = 104;
  choose(0); game.update(); choose(0.999); next(game); choose(0); next(game);
  expect(game.minervaReprise?.seen).toEqual([0, 8, 0]);
  next(game);
  expect(game.minervaReprise?.prayer).toBe(true);
  expect(game.minervaReprise?.seen).toEqual([0, 8, 0]);
  choose(0.5); next(game);
  expect(game.minervaReprise?.cycle).toBe(4);
  expect(game.minervaReprise?.seen).toEqual([0, 8, 0, 4]);
  game.startBoss(false, 10); expect(game.minervaReprise).toBeUndefined();
  game.phaseFrame = 104; game.update(); expect(game.minervaReprise?.seen).toEqual([4]);
  game.startStage(5); expect(game.minervaReprise).toBeUndefined();
});

it('借りる技をVim以外の9技に絞る', () => {
  expect(new Set(REPRISES.map(source => source.boss)).size).toBe(4);
  expect(REPRISES.map(source => source.phase.pattern)).toEqual([
    'enter', 'link', 'sweep', 'type', 'grid', 'jinraiKiss', 'jinraiSakura', 'jinraiClone', 'jinraiPetal',
  ]);
});

it('花影は召喚後に二身・三身へ分かれ、どの分身も共有HPへ通常の2/3のダメージを受ける', () => {
  const index = REPRISES.findIndex(source => source.phase.pattern === 'jinraiClone');
  vi.spyOn(Math, 'random').mockReturnValue((index + 0.5) / REPRISES.length);
  const game = fight(); game.phaseFrame = 104; game.update();
  expect(game.bossTargets()).toEqual([game.bossXY]);
  const start = game.minervaReprise!.startFrame + reprisePrepare(game.minervaReprise!) - CLONE_FIRST_CHARGE;
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

it('借りる技を3・4・3回と挟み、3回目の祈りをHP10%から撃破まで保つ', () => {
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
  expect(game.phaseHp / game.phaseMaxHp).toBeCloseTo(0.1);
  game.phaseHp = game.phaseMaxHp * 0.01; game.update();
  expect(game.minervaReprise?.cycle).toBe(12); expect(game.minervaReprise?.prayer).toBe(true);
});

it.each(difficulties)('借りる技の%sは段階強化し、祈りは中盤まで選択難易度・最後だけ1段上にする', difficulty => {
  const stronger = { easy: 'normal', normal: 'hard', hard: 'lunatic', lunatic: 'lunatic' }[difficulty];
  const strongest = { easy: 'hard', normal: 'lunatic', hard: 'lunatic', lunatic: 'lunatic' }[difficulty];
  const game = fight('owlDawn', difficulty); game.phaseFrame = 104; game.update();
  for (let cycle = 0; cycle <= 12; cycle++) {
    const borrowed = cycle >= 9 ? strongest : cycle >= 4 ? stronger : difficulty;
    const expected = game.minervaReprise!.prayer ? cycle === 12 ? stronger : difficulty : borrowed;
    expect(repriseDifficulty(difficulty, cycle)).toBe(borrowed);
    expect(game.minervaReprise?.difficulty).toBe(expected);
    expect(game.difficulty).toBe(difficulty);
    if (game.minervaReprise!.prayer) {
      game.minervaReprise!.supplied = true; game.bullets.clear();
      game.phaseFrame = game.minervaReprise!.startFrame + PRAYER_CHARGE + 12 - 1; game.update();
      expect(repriseView(game)).toBe(game);
      const bullets = game.bullets.objects.filter(b => b.active);
      const level = difficulties.indexOf(expected as Game['difficulty']);
      expect(bullets).toHaveLength([5, 7, 9, 11][level]);
      expect(Math.hypot(bullets[0].vx, bullets[0].vy)).toBeCloseTo([2.6, 3, 3.6, 4.2][level]);
    } else expect(repriseView(game).difficulty).toBe(expected);
    if (cycle < 12) next(game);
  }
});

it('各枠の超過ダメージが最後の祈りへ累積しない', () => {
  const game = fight(); game.phaseFrame = 104; game.update();
  for (let cycle = 1; cycle <= 12; cycle++) {
    finishAwakening(game);
    const overshoot = cycle % 2 ? 20 : 1;
    game.phaseHp = game.phaseMaxHp * (1 - cycle * 0.075) - overshoot; game.update();
    expect(game.minervaReprise?.cycle).toBe(cycle);
  }
  expect(game.phaseHp).toBeCloseTo(game.phaseMaxHp * 0.1 - 1);
});

it.each(REPRISES.map((source, index) => ({ pattern: source.phase.pattern, index })))('第3区間の$patternはセリフ・補給・オーラを待ってから動く', ({ index }) => {
  const game = fight(); prayer(game, 8);
  const entry = game.bossXY;
  game.spawnBullet(100, 200, 0, 1, 0);
  game.jinraiLasers.push({ x: 192, y: 132, angle: 0, age: 80, warning: 60, life: 260, speed: 0.003 });
  const node = { x: 100, y: 200, radius: 5, age: 100, warning: 80, fadeAt: 600, color: 0, label: '', grazed: false, announced: true };
  game.graphNodes.push(node); game.graphEdges.push({ from: node, to: { ...node, x: 300 }, grazed: false });
  next(game); game.minervaReprise!.index = index; game.cutin = 0;
  const reprise = game.minervaReprise!, hp = game.phaseHp;
  expect(reprise.cycle).toBe(9); expect(reprise.difficulty).toBe('lunatic');
  expect(reprise.entry).toEqual(entry);
  let frames = 0;
  while (reprise.finale && frames++ < 1800) {
    expect(game.minervaReprise).toBe(reprise);
    expect(game.bullets.count + game.jinraiLasers.length + game.graphNodes.length + game.graphEdges.length).toBe(0);
    expect(repriseView(game).phaseFrame).toBeLessThan(105);
    expect(game.phaseHp).toBe(hp);
    expect(game.bossTargets()).toEqual([game.bossXY]);
    if (reprise.finale.stage !== 'hold') expect(game.bossXY).toEqual(entry);
    const [x, y] = game.bossXY, shot = game.shots.acquire()!;
    Object.assign(shot, { x, y, vx: 0, vy: 0, radius: 3, damage: 30, homing: false });
    game.update();
  }
  expect(reprise.finale).toBeUndefined();
  expect(repriseView(game).phaseFrame).toBeGreaterThanOrEqual(105);
  let hazards = 0;
  for (let frame = 0; frame < 600; frame++) {
    hazards = Math.max(hazards, game.bullets.count + game.jinraiLasers.length + game.graphNodes.length);
    game.update();
  }
  expect(hazards).toBeGreaterThan(0);
});

it('本気への切替は本体接触でも被弾せず、ポーズで止まり、ボムで飛ばず、次の技では繰り返さない', () => {
  const game = fight(); prayer(game, 8); next(game);
  game.minervaReprise!.index = 8; game.cutin = 0; game.invincible = false; game.invulnFrames = 0;
  const start = game.phaseFrame, hp = game.phaseHp;
  for (let local = 0; local < 149; local++) {
    [game.px, game.py] = game.bossXY; game.update();
    expect(game.pendingHit).toBe(-1); expect(game.phaseHp).toBe(hp);
  }
  keydown({ code: 'Escape', repeat: false, preventDefault() {} }); game.update();
  game.keys.delete('Escape');
  expect(game.scene).toBe('pause');
  for (let frame = 0; frame < 30; frame++) game.update();
  expect(game.phaseFrame).toBe(start + 149);
  keydown({ code: 'Escape', repeat: false, preventDefault() {} }); game.update();
  expect(game.scene).toBe('stage');
  game.invincible = true; finishAwakening(game);
  game.invincible = false; game.invulnFrames = 0;
  [game.px, game.py] = game.bossXY;
  game.update(); expect(game.pendingHit).toBeGreaterThanOrEqual(0);

  const bombed = fight(); prayer(bombed, 8); next(bombed); bombed.cutin = 0;
  const bombHp = bombed.phaseHp, bombStart = bombed.phaseFrame, bombs = bombed.bombs;
  bombed.bombFrames = 20;
  keydown({ code: 'KeyX', repeat: false, preventDefault() {} }); bombed.update();
  expect(bombed.bombFrames).toBeGreaterThan(0);
  while (bombed.phaseFrame < bombStart + 149) bombed.update();
  expect(bombed.phaseHp).toBe(bombHp); expect(bombed.minervaReprise?.cycle).toBe(9);
  expect(bombed.bombs).toBe(bombs); expect(bombed.bombUsed).toBe(false);
  next(bombed); expect(reprisePrepare(bombed.minervaReprise!)).toBe(60);
  bombed.startBoss(false, 10); expect(bombed.minervaReprise).toBeUndefined();
  prayer(bombed, 8); next(bombed);
  expect(bombed.minervaReprise?.finale?.stage).toBe('silence');

  const deathbombed = fight(); prayer(deathbombed, 8); next(deathbombed); deathbombed.cutin = 0;
  deathbombed.pendingHit = 0;
  const beforeBombs = deathbombed.bombs;
  keydown({ code: 'KeyX', repeat: false, preventDefault() {} }); deathbombed.update();
  expect(deathbombed.pendingHit).toBe(-1); expect(deathbombed.bombs).toBe(beforeBombs - 1);
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
  game.phaseFrame = game.minervaReprise!.startFrame + reprisePrepare(game.minervaReprise!);
  game.cutin = 0; // 時計を召喚後へ飛ばしたので、宣言も終了した状態にする。
  expect(hit(game)).toBeCloseTo(20);
  const hp = game.phaseHp;
  keydown({ code: 'KeyX', repeat: false, preventDefault() {} }); game.update();
  expect(hp - game.phaseHp).toBeCloseTo(24);
  const ordinary = fight('interview'); ordinary.phaseFrame = 200;
  expect(hit(ordinary)).toBeCloseTo(30);
});

it.each(difficulties)('祈りの%sは1回目が1種、中盤と最後は途中から逆回転の星弾も出す', difficulty => {
  const stronger = { easy: 'normal', normal: 'hard', hard: 'lunatic', lunatic: 'lunatic' }[difficulty];
  for (const cycle of [3, 8, 12]) {
    const game = fight('owlDawn', difficulty); prayer(game, cycle);
    const level = difficulties.indexOf((cycle === 12 ? stronger : difficulty) as Game['difficulty']);
    const arms = [5, 7, 9, 11][level];
    while (dawnPrayerStep(game.phaseFrame, game.minervaReprise) < PRAYER_CHARGE + 72) {
      game.update();
      if (dawnPrayerStep(game.phaseFrame, game.minervaReprise) < PRAYER_CHARGE + 72) expect(game.bullets.objects.some(b => b.active && b.kind === 'star')).toBe(false);
    }
    const added = game.bullets.objects.filter(b => b.active && b.kind === 'star');
    expect(added).toHaveLength(cycle >= 8 ? arms : 0);
    if (added.length) {
      const direction = cycle === 8 ? -1 : 1, speed = [2.3, 2.7, 3.2, 3.7][level];
      expect(added[0].vx).toBeCloseTo(Math.cos(Math.PI / 2 - direction * 72 * 0.027 + Math.PI / arms) * speed);
      expect(Math.hypot(added[0].vx, added[0].vy)).toBeCloseTo(speed);
      const interval = [4, 3, 2, 2][level] * 2;
      for (let frame = 1; frame <= interval; frame++) {
        game.update();
        expect(game.bullets.objects.filter(b => b.active && b.kind === 'star')).toHaveLength(arms * (frame < interval ? 1 : 2));
      }
    }
  }
});

it('再演中も本体のHPと時計を保ち、リターンのショット反射が働く', () => {
  const index = REPRISES.findIndex(s => s.phase.pattern === 'enter');
  vi.spyOn(Math, 'random').mockReturnValue((index + 0.5) / REPRISES.length);
  const game = fight(); game.phaseFrame = 104; game.update();
  const view = repriseView(game);
  expect(view.phase?.pattern).toBe('enter'); expect(game.phase?.pattern).toBe('owlDawn');
  expect(view.phaseFrame).toBe(105 - reprisePrepare(game.minervaReprise!)); expect(game.phaseFrame).toBe(105);
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

it.each(difficulties)('祈りの%sは最初の発散で残機・大型パワー・ボムを弾に混ぜ、同じHP区間で繰り返さない', difficulty => {
  const game = fight('owlDawn', difficulty); game.power = 3; game.lives = 2; game.bombs = 1;
  const spawn = vi.spyOn(game, 'spawnItem'); prayer(game); const start = game.phaseFrame;
  while (game.phaseFrame < start + PRAYER_CHARGE - 1) { expect(spawn).not.toHaveBeenCalled(); game.update(); }
  expect(spawn).not.toHaveBeenCalled(); game.update();
  const items = game.items.objects.filter(item => item.active);
  expect(items.map(item => item.kind)).toEqual(['life', 'large', 'bomb']);
  expect(items.every(item => item.vy > 0 && item.manual && !item.auto)).toBe(true);
  const [x, y] = game.bossXY;
  for (const [spawnX, spawnY] of spawn.mock.calls) expect(Math.hypot(spawnX - x, spawnY - y)).toBeCloseTo(22);
  expect(game.bullets.count).toBe({ easy: 4, normal: 6, hard: 8, lunatic: 10 }[difficulty]);
  for (let frame = 0; frame < 30; frame++) game.update();
  for (const item of items) { game.px = item.x; game.py = item.y; game.update(); expect(item.active).toBe(false); }
  expect(game.lives).toBe(3); expect(game.power).toBe(4); expect(game.bombs).toBe(2);
  while (game.phaseFrame < start + PRAYER_PERIOD * 3) game.update();
  expect(spawn.mock.calls.map(([, , kind]) => kind)).toEqual(['life', 'large', 'bomb']);
});

it.each([[4, 0, false], [5, 0.2499, true], [5, 0.25, false], [5, 0.99, false]] as const)('Power%sで抽選%sの時だけ光の羽根を追加する=%s', (power, roll, rare) => {
  vi.spyOn(Math, 'random').mockReturnValue(roll);
  const game = fight(); game.power = power; const spawn = vi.spyOn(game, 'spawnItem'); prayer(game);
  expect(spawn).not.toHaveBeenCalled();
  while (!game.minervaReprise!.supplied) game.update();
  expect(spawn.mock.calls.map(([, , kind]) => kind)).toEqual(['life', 'large', 'bomb', ...(rare ? ['radiant'] : [])]);
  if (rare) {
    const item = game.items.objects.find(item => item.active && item.kind === 'radiant')!;
    game.px = item.x; game.py = item.y; game.update(); expect(game.awakened).toBe(true); expect(game.power).toBe(5);
  }
});

it('祈りごとに1セットずつ補給し、ボム中も配る', () => {
  for (const bombFrames of [0, 20]) {
    const game = fight(); game.phaseFrame = 104; game.update(); next(game); next(game);
    const spawn = vi.spyOn(game, 'spawnItem'); next(game);
    expect(spawn).not.toHaveBeenCalled();
    game.phaseFrame = game.minervaReprise!.startFrame + PRAYER_CHARGE - 1; game.bombFrames = bombFrames; game.update();
    expect(spawn.mock.calls.map(([, , kind]) => kind)).toEqual(['life', 'large', 'bomb']);
    for (let i = 0; i < 5; i++) next(game);
    expect(game.minervaReprise?.prayer).toBe(true); expect(game.minervaReprise?.supplied).toBe(false);
    game.bombFrames = 0; game.phaseFrame = game.minervaReprise!.startFrame + PRAYER_CHARGE - 1; game.update();
    expect(spawn.mock.calls.map(([, , kind]) => kind)).toEqual(['life', 'large', 'bomb', 'life', 'large', 'bomb']);
  }
});
