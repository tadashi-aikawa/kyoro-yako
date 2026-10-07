import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { bowProgress, FAREWELL_RELEASE } from './patterns/claudine';
import { MID_PHASE, PHASE_LIMIT, phaseHp, STAGE_DPS, STAGES } from './stages';

beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => vi.unstubAllGlobals());

function start(stage: number, index: number, mid = false, difficulty: Game['difficulty'] = 'normal'): Game {
  const game = new Game(); game.audio.volume = 0; game.invincible = true; game.difficulty = difficulty;
  game.startStage(stage); game.startBoss(mid, index); game.phaseFrame = 104; game.update();
  return game;
}

it('全フェーズは面と種類の共通式から体力と制限時間を得る', () => {
  expect([phaseHp(3, 'normal'), phaseHp(3, 'spell'), phaseHp(3, 'midboss')]).toEqual([680, 1215, 875]);
  for (const [index, stage] of STAGES.entries()) {
    for (const phase of stage.phases) {
      expect(phase.hp).toBe(phaseHp(index + 1, phase.kind));
      expect(phase.duration).toBe(phase.kind === 'survival' ? 60 : PHASE_LIMIT[phase.kind]);
      if (phase.kind !== 'survival') expect(phase.hp / STAGE_DPS[index]).toBeCloseTo(phase.kind === 'normal' ? 14 : 25, 0);
    }
    const mid = MID_PHASE[stage.mid];
    expect(mid.hp).toBe(phaseHp(index + 1, 'midboss'));
    expect(mid.duration).toBe(45);
  }
});

it('全5面の全フェーズにURLから直行できる', () => {
  for (const stage of [1, 2, 3, 4, 5]) {
    if (stage <= 2) expect(STAGES[stage - 1].phases).toHaveLength(7);
    for (const [index, phase] of STAGES[stage - 1].phases.entries()) {
      vi.stubGlobal('location', { search: `?boss=${stage}&phase=${index}` });
      const game = new Game(); game.audio.volume = 0;
      expect(game.phase).toBe(phase);
      expect(game.phaseIndex).toBe(index);
    }
  }
});

it('エトワールの星は予告後に楕円軌道から重力でこぼれる', () => {
  const game = start(1, 0, true);
  const star = game.bullets.objects.find((b) => b.active && b.motion === 'etoileOrbit')!;
  expect(star).toBeDefined();
  star.age = star.releaseAt - 2;
  game.update();
  expect(star.color).toBe(1);
  game.update();
  expect(star.motion).toBe('etoileFall');
  const vy = star.vy;
  game.update();
  expect(star.vy).toBeGreaterThan(vy);
});

it('キーバインドは光るキーだけが予告後に落ち、円には切れ目がある', () => {
  const rain = start(1, 1);
  const keys = rain.bullets.objects.filter((b) => b.active && b.motion === 'keyDrop');
  expect(keys).toHaveLength(3);
  const y = keys[0].y;
  for (let i = 0; i < 58; i++) rain.update();
  expect(keys[0].y).toBeGreaterThan(y);
  const circle = start(1, 3);
  const caps = circle.bullets.objects.filter((b) => b.active && b.motion === 'keyCircle');
  expect(caps).toHaveLength(12);
  expect(caps.every((b) => b.delay > 0)).toBe(true);
});

it('沼では弾と自機が減速し、Enterの列は予告中に止まる', () => {
  const bog = start(1, 5);
  bog.px = 78; bog.py = 235;
  bog.keys.add('ArrowRight');
  const px = bog.px;
  const bullet = bog.spawnBullet(78, 235, 1, 0, 0)!;
  bog.update();
  expect(bullet.x).toBeCloseTo(78.28);
  expect(bog.px - px).toBeCloseTo(3.65 * 0.55);
  const enter = start(1, 6);
  const glyph = enter.bullets.objects.find((b) => b.active && b.motion === 'enterLine')!;
  expect(glyph.delay).toBeGreaterThan(0);
  const y = glyph.y;
  enter.update();
  expect(glyph.y).toBe(y);
});

it('書棚は背表紙の予告後に突き出し、リングの点滅弾は消える', () => {
  const shelf = start(2, 0, true);
  const book = shelf.bullets.objects.find((b) => b.active && b.motion === 'bookshelf')!;
  expect(book.delay).toBeGreaterThan(0);
  const x = book.x;
  for (let i = 0; i < 111; i++) shelf.update();
  expect(book.x).toBeGreaterThan(x);
  expect(book.x).toBeGreaterThan(100);
  expect(shelf.bullets.objects.filter((b) => b.active && b.motion === 'bookshelf')).toHaveLength(3);
  const clean = start(2, 1);
  const vanish = clean.bullets.objects.find((b) => b.active && b.motion === 'vanish')!;
  expect(vanish).toBeDefined();
  for (let i = 0; i < vanish.fadeAt; i++) clean.update();
  expect(vanish.active).toBe(false);
});

it('3面のボスは通常4回とスペル6枚を順に出す', () => {
  expect(STAGES[2].phases.map((phase) => phase.pattern)).toEqual(['fan', 'trim', 'spiral', 'type', 'fan', 'grid', 'spiral', 'complement', 'whiteSpace', 'final']);
  expect(STAGES[2].phases.filter((phase) => phase.spell)).toHaveLength(6);
});

it('箱は予告が終わると全方位へ開き、Easyの予告は長い', () => {
  const easy = start(3, 0, true, 'easy');
  const normal = start(3, 0, true);
  const easyBox = easy.bullets.objects.find((b) => b.active && b.motion === 'codexBox')!;
  const box = normal.bullets.objects.find((b) => b.active && b.motion === 'codexBox')!;
  expect(easyBox.delay).toBeGreaterThan(box.delay);
  for (let i = 0; i < 181; i++) normal.update();
  expect(box.active).toBe(false);
  expect(normal.message).toBe('完成しました。ご確認ください。');
  expect(normal.bullets.objects.filter((b) => b.active && b.kind === 'orb').length).toBeGreaterThanOrEqual(11);
});

it('削ぎ落としの壁は予告された列が消えてから降る', () => {
  const game = start(3, 1);
  const cut = game.bullets.objects.find((b) => b.active && b.motion === 'trim')!;
  const wall = game.bullets.objects.find((b) => b.active && b.motion === 'normal')!;
  const y = wall.y;
  for (let i = 0; i < 80; i++) game.update();
  expect(cut.active).toBe(false);
  expect(wall.y).toBeGreaterThan(y);
});

it('グリッド弾は薄い配置予告の後に一斉に実体化して動く', () => {
  const game = start(3, 5);
  const bullets = game.bullets.objects.filter((b) => b.active && b.motion === 'layoutGrid');
  expect(new Set(bullets.map((b) => b.gridColumn)).size).toBe(12);
  expect(bullets.every((b) => b.delay > 0)).toBe(true);
  for (let i = 0; i < 68; i++) game.update();
  expect(bullets.every((b) => b.motion === 'layoutGrid')).toBe(true);
  game.update(); game.update();
  expect(bullets.every((b) => b.motion === 'normal' && b.vx === 0 && b.vy > 0)).toBe(true);
});

it('補色の境界で弾の色と速さが変わり、余白の円から弾が消える', () => {
  const color = start(3, 7);
  const orb = color.bullets.objects.find((b) => b.active && b.motion === 'complement' && b.x < 190)!;
  orb.delay = 0; orb.x = 200; orb.y = 220; orb.vx = -2;
  color.update();
  expect(orb.color).toBe(3);
  for (let i = 0; i < 20; i++) color.update();
  expect(orb.color).toBe(1);
  const space = start(3, 8);
  const bullet = space.spawnBullet(192, 302, 0, 0, 0)!;
  bullet.motion = 'whiteSpace';
  space.update();
  expect(bullet.active).toBe(false);
});

it('耐久は5つの仕掛けを10秒ずつ切り替える', () => {
  const game = start(3, 9);
  for (const [segment, motion] of ['trim', 'typographyRain', 'layoutGrid', 'complement', 'whiteSpace'].entries()) {
    game.phaseFrame = 104 + segment * 600;
    game.update();
    expect(game.bullets.objects.some((b) => b.active && b.motion === motion), `segment ${segment}`).toBe(true);
  }
  game.phaseFrame = 3104;
  game.update();
  expect(game.bullets.count).toBe(0);
});

it('別符の締めは会釈中に花形の輪を2回放ち、時間切れ前に画面外へ出す', () => {
  expect(bowProgress(3000)).toBe(0);
  expect(bowProgress(3120)).toBe(1);
  expect(bowProgress(3400)).toBe(0);
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    const game = start(3, 9, false, difficulty);
    game.phaseFrame = 3104;
    game.update();
    const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
    const expected = [18, 24, 30, 36][level];
    const releases: readonly number[] = FAREWELL_RELEASE[level];
    let lastVisible = 0;
    for (let t = 3001; t <= 3494; t++) {
      game.update();
      if (game.bullets.objects.some((b) => b.active && b.motion === 'farewellFlower' && b.x >= 0 && b.x <= 384 && b.y >= 0 && b.y <= 448)) lastVisible = t;
      const wave = releases.indexOf(t);
      if (wave < 0) continue;
      expect(game.bullets.objects.filter((b) => b.active && b.motion === 'farewellFlower' && b.gridRow === wave)).toHaveLength(expected);
    }
    const visible = game.bullets.objects.filter((b) => b.active && b.motion === 'farewellFlower' && b.x >= 0 && b.x <= 384 && b.y >= 0 && b.y <= 448);
    expect(lastVisible, difficulty).toBeGreaterThan(3440);
    expect(visible, difficulty).toHaveLength(0);
  }
});

it('5面ネオの延長は1面の3つの仕掛けを順に使い、★は1つのまま', () => {
  const game = start(5, 0, true);
  expect(game.remainingSpells).toBe(1);
  for (const [extension, motion] of ['keyDrop', 'keyCircle', 'normal'].entries()) {
    game.encoreCount = extension + 1;
    game.phaseFrame = 104;
    game.bullets.clear();
    game.update();
    expect(game.bullets.objects.some((b) => b.active && b.motion === motion), `extension ${extension + 1}`).toBe(true);
    expect(game.remainingSpells).toBe(1);
  }
  game.skipPhase();
  expect(game.remainingSpells).toBe(0);
});

it('Wiki網は予告線から降り、タグ弾は対応する色の魔法陣へ曲がる', () => {
  const link = start(2, 3);
  const beam = link.bullets.objects.find((b) => b.active && b.motion === 'linkBeam')!;
  expect(beam.delay).toBeGreaterThan(0);
  const y = beam.y;
  for (let i = 0; i < 67; i++) link.update();
  expect(beam.y).toBeGreaterThan(y);
  const tag = start(2, 5);
  const orb = tag.bullets.objects.find((b) => b.active && b.motion === 'tagPull')!;
  const vx = orb.vx;
  tag.update();
  expect(orb.vx).not.toBe(vx);
});

it('一掃は移動と溜めの後に四方へ広がる', () => {
  const game = start(2, 6);
  expect(game.bullets.count).toBe(0);
  for (let i = 0; i < 114; i++) game.update();
  const ring = game.bullets.objects.filter((b) => b.active && b.motion === 'sweepRadial');
  expect(ring).toHaveLength(36);
  for (const axis of ['vx', 'vy'] as const) {
    expect(ring.some((b) => b[axis] < 0)).toBe(true);
    expect(ring.some((b) => b[axis] > 0)).toBe(true);
  }
});

it('Easyほど各スペルの予告が長い', () => {
  for (const [stage, phase, motion, mid] of [
    [1, 0, 'etoileOrbit', true],
    [1, 1, 'keyDrop', false],
    [1, 3, 'keyCircle', false],
    [1, 6, 'enterLine', false],
    [2, 0, 'bookshelf', true],
    [2, 3, 'linkBeam', false],
  ] as const) {
    const easy = start(stage, phase, mid, 'easy').bullets.objects.find((b) => b.active && b.motion === motion)!;
    const lunatic = start(stage, phase, mid, 'lunatic').bullets.objects.find((b) => b.active && b.motion === motion)!;
    expect(easy.delay || easy.releaseAt, motion).toBeGreaterThan(lunatic.delay || lunatic.releaseAt);
  }
});
