import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { DAWN_CYCLE, PRAYER_CHARGE } from './patterns/minerva-dawn';
import { REPRISE_PREPARE, REPRISE_TIME, REPRISES, repriseView } from './patterns/minerva-reprise';

const difficulties = ['easy', 'normal', 'hard', 'lunatic'] as const;
beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function fight(index: number, difficulty: Game['difficulty'] = 'normal'): Game {
  const game = new Game(); game.audio.volume = 0; game.difficulty = difficulty;
  game.startStage(5); game.startBoss(false, index); game.invincible = true;
  return game;
}

it.each(difficulties)('再演12種類は%sで元の仕掛けを動かし、祈りへ切り替えると全て片付く', difficulty => {
  expect(REPRISES).toHaveLength(12);
  expect(new Set(REPRISES.map(source => source.boss)).size).toBe(4);
  for (const [index, source] of REPRISES.entries()) {
    vi.spyOn(Math, 'random').mockReturnValue((index + 0.5) / REPRISES.length);
    const game = fight(12, difficulty); game.phaseFrame = 104;
    const actualPhase = game.phase;
    let bullets = 0, lasers = 0, nodes = 0, maxMove = 0;
    let previous = game.bossXY;
    while (game.phaseFrame < 105 + REPRISE_TIME - 1) {
      game.update();
      expect(game.phase).toBe(actualPhase);
      expect(game.boss).toBe('minerva'); expect(game.phase?.duration).toBe(Infinity);
      expect(game.minervaReprise?.index).toBe(index);
      const position = game.bossXY;
      maxMove = Math.max(maxMove, Math.hypot(position[0] - previous[0], position[1] - previous[1])); previous = position;
      bullets = Math.max(bullets, game.bullets.count); lasers = Math.max(lasers, game.jinraiLasers.length); nodes = Math.max(nodes, game.graphNodes.length);
      expect(game.bullets.count, source.phase.name).toBeLessThan(1000);
      game.bullets.forEach(b => { expect(Number.isFinite(b.x) && Number.isFinite(b.y), source.phase.name).toBe(true); });
      if (game.phaseFrame < 105 + REPRISE_PREPARE) expect(game.bullets.count).toBe(0);
    }
    expect(maxMove, source.phase.name).toBeLessThan(8);
    expect(bullets + lasers + nodes, source.phase.name).toBeGreaterThan(0);
    if (source.phase.pattern === 'link') expect(nodes).toBeGreaterThan(15);
    if (source.phase.pattern === 'jinraiLaser') expect(lasers).toBeGreaterThan(0);
    game.update();
    expect(game.bullets.count).toBe(0); expect(game.graphNodes).toHaveLength(0); expect(game.jinraiLasers).toHaveLength(0);
    expect(repriseView(game)).toBe(game);
    for (let i = 0; i < PRAYER_CHARGE; i++) game.update();
    expect(game.bullets.objects.filter(b => b.active && b.age === 1)).toHaveLength([5, 7, 9, 11][difficulties.indexOf(difficulty)]);
    vi.restoreAllMocks();
  }
});

it('抽選は周期ごとに独立し、同じ技の連続も選べる。HPやボムで再抽選しない', () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.01);
  const game = fight(12); game.phaseFrame = 104; game.update();
  expect(game.minervaReprise?.index).toBe(0);
  const first = game.minervaReprise;
  game.phaseHp = game.phaseMaxHp * 0.1; game.bombFrames = 20;
  while (game.bombFrames > 0) { game.update(); expect(game.minervaReprise).toBe(first); }
  game.phaseFrame = 104 + DAWN_CYCLE; game.update();
  expect(game.minervaReprise?.cycle).toBe(1); expect(game.minervaReprise?.index).toBe(0);
  random.mockReturnValue(0.999);
  game.phaseFrame = 104 + DAWN_CYCLE * 2; game.update();
  expect(game.minervaReprise?.index).toBe(11);
  game.startBoss(false, 11); expect(game.minervaReprise).toBeUndefined();
});

it('再演中も本体のHPと時計を保ち、リターンのショット反射が働く', () => {
  const index = REPRISES.findIndex(s => s.phase.pattern === 'enter');
  vi.spyOn(Math, 'random').mockReturnValue((index + 0.5) / REPRISES.length);
  const game = fight(12); game.phaseFrame = 104; game.update();
  const view = repriseView(game);
  expect(view.phase?.pattern).toBe('enter'); expect(game.phase?.pattern).toBe('owlDawn');
  expect(view.phaseFrame).toBe(45); expect(game.phaseFrame).toBe(105);
  game.phaseFrame = 400; game.bullets.clear();
  const letter = game.spawnBullet(192, 280, 0, 0, 1, 'glyph')!;
  letter.motion = 'enterLine'; letter.delay = 0; letter.radius = 4;
  const shot = game.shots.acquire()!; Object.assign(shot, { x: 192, y: 290, vx: 0, vy: -20, damage: 2, radius: 3, homing: false });
  const hp = game.phaseHp; game.update();
  expect(shot.active).toBe(false); expect(game.phaseHp).toBe(hp);
  expect(game.bullets.objects.some(b => b.active && b.kind === 'needle')).toBe(true);
});

it.each(difficulties)('リトラクションは%sで全弾が画面外へ出てから同じ原点に帰る', difficulty => {
  const game = fight(9, difficulty); game.phaseFrame = 104; game.update();
  const bullets = game.bullets.objects.filter(b => b.active && b.motion === 'recall');
  const outside = new Set<object>();
  while (bullets.some(b => b.active)) {
    game.update();
    for (const b of bullets) if (b.active && b.age >= b.gridRow && b.age < b.releaseAt) {
      expect(b.x < 0 || b.x > 384 || b.y < 0 || b.y > 448).toBe(true); outside.add(b);
    }
  }
  expect(outside.size).toBe(bullets.length);
});
