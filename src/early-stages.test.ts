import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { claudineScene } from './patterns/claudine';
import { FINALE_CHARGE, FINALE_START, ROSE_COUNT, ROSE_PERIOD } from './patterns/claudine-finale';
import { vimScene } from './patterns/neo';
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

it('キーバインドは光るキーだけが予告後に落ち、Vimは予告中に弾を出さない', () => {
  const rain = start(1, 1);
  const keys = rain.bullets.objects.filter((b) => b.active && b.motion === 'keyDrop');
  expect(keys).toHaveLength(6);
  const y = keys[0].y;
  for (let i = 0; i < 74; i++) rain.update();
  expect(keys[0].y).toBeGreaterThan(y);
  const vim = start(1, 3);
  expect(vim.vimAttack).toBeDefined(); expect(vim.bullets.count).toBe(0);
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
  expect(STAGES[2].phases.map((phase) => phase.pattern)).toEqual(['claudinePetalArc', 'trim', 'claudineQuietRings', 'type', 'claudinePetalArc', 'grid', 'claudineQuietRings', 'complement', 'whiteSpace', 'final']);
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

it('耐久は5つの仕掛けを再演し、残り10秒で締めへ切り替える', () => {
  const game = start(3, 9);
  for (const [segment, motion] of ['trim', 'typographyRain', 'layoutGrid', 'complement', 'whiteSpace'].entries()) {
    game.phaseFrame = 104 + segment * 600;
    game.update();
    expect(game.bullets.objects.some((b) => b.active && b.motion === motion), `segment ${segment}`).toBe(true);
  }
  game.phaseFrame = FINALE_START - 1;
  game.update();
  expect(game.bullets.count).toBe(0);
});

it('残り10秒で旧弾を消し、1秒の構えから薔薇と自機狙いを撃ち続ける', () => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    const game = start(3, 9, false, difficulty);
    game.phaseFrame = FINALE_START - 2;
    expect(claudineScene(game)).toBe('whiteSpace');
    game.update();
    game.spawnBullet(game.px, game.py - 100, 0, 1, 0);
    game.message = 'EXTEND!'; game.messageFrames = 90;
    game.update();
    expect(claudineScene(game)).toBe('rose');
    expect(game.messageFrames).toBe(89);
    expect(game.bullets.count).toBe(0);
    for (let i = 1; i < FINALE_CHARGE; i++) game.update();
    expect(game.bullets.count).toBe(0);
    game.update();
    const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
    const roses = game.bullets.objects.filter((b) => b.active && b.motion === 'farewellRose');
    expect(roses).toHaveLength(ROSE_COUNT[level]);
    for (let i = 0; i < ROSE_PERIOD[level] / 2; i++) game.update();
    const fan = game.bullets.objects.filter((b) => b.active && b.motion === 'farewellLance');
    expect(fan).toHaveLength([5, 7, 9, 11][level]);
    const center = fan[(fan.length - 1) / 2];
    expect(Math.atan2(center.vy, center.vx)).toBeCloseTo(Math.atan2(game.py - game.bossXY[1], game.px - game.bossXY[0]));
    const velocity = [center.vx, center.vy];
    game.px = 30; game.update();
    expect([center.vx, center.vy]).toEqual(velocity);
    // 旧来の600f区切りで新技の弾が消えない。
    while (game.phaseFrame < 3105) game.update();
    expect(roses.some((b) => b.active)).toBe(true);
    let maxCount = 0;
    while (game.phaseFrame < 3599) {
      game.update(); maxCount = Math.max(maxCount, game.bullets.count);
      const fired = game.bullets.objects.filter((b) => b.active && b.age === 1);
      expect(fired.some((b) => b.motion === 'farewellRose') && fired.some((b) => b.motion === 'farewellLance')).toBe(false);
    }
    expect(game.bullets.objects.some((b) => b.active && b.age <= ROSE_PERIOD[level] && b.motion === 'farewellRose')).toBe(true);
    expect(maxCount).toBeLessThan(350);
    expect(game.phase?.pattern).toBe('final');
    game.update();
    expect(game.phase).toBeUndefined();
    expect(game.collectionFrames).toBe(180);
    expect(game.bullets.count).toBe(0);
    for (let i = 0; i < 180; i++) game.update();
    expect(game.scene).toBe('dialogue');
  }
});

it('5面ネオの延長は1面の3つの仕掛けを順に使い、★は1つのまま', () => {
  const game = start(5, 0, true);
  expect(game.remainingSpells).toBe(1);
  for (const [extension, motion] of ['keyDrop', 'vim', 'normal'].entries()) {
    game.encoreCount = extension + 1;
    game.phaseFrame = 104;
    game.bullets.clear();
    game.update();
    if (extension === 1) expect(game.vimAttack).toBeDefined();
    else expect(game.bullets.objects.some((b) => b.active && b.motion === motion), `extension ${extension + 1}`).toBe(true);
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
    [1, 6, 'enterLine', false],
    [2, 0, 'bookshelf', true],
    [2, 3, 'linkBeam', false],
  ] as const) {
    const easy = start(stage, phase, mid, 'easy').bullets.objects.find((b) => b.active && b.motion === motion)!;
    const lunatic = start(stage, phase, mid, 'lunatic').bullets.objects.find((b) => b.active && b.motion === motion)!;
    expect(easy.delay || easy.releaseAt, motion).toBeGreaterThan(lunatic.delay || lunatic.releaseAt);
  }
  expect(vimScene(0, 0).warning).toBeGreaterThan(vimScene(0, 3).warning);
});
