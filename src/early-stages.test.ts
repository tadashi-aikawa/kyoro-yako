import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { claudineScene } from './patterns/claudine';
import { vimScene } from './patterns/neo';
import { midPhases, PHASE_LIMIT, phaseHp, STAGE_DPS, STAGES } from './stages';

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
      expect(phase.duration).toBe(phase.pattern === 'jinraiDash' ? Infinity : phase.pattern === 'final' ? 99 : PHASE_LIMIT[phase.kind]);
      expect(phase.hp / STAGE_DPS[index]).toBeCloseTo(phase.kind === 'normal' ? 14 : phase.kind === 'finale' ? 60 : 25, 0);
    }
    const mid = midPhases(stage.mid, index + 1)[0];
    if (stage.mid === 'chappy') expect([mid.hp, mid.duration]).toEqual([405, 28]);
    else {
      expect(mid.hp).toBe(phaseHp(index + 1, 'midboss'));
      expect(mid.duration).toBe(45);
    }
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

it('ヨーヨーはEasyの予告が長く、Normalは先に投げ始める', () => {
  const easy = start(3, 0, true, 'easy');
  const normal = start(3, 0, true);
  const easyYoyo = easy.bullets.objects.find((b) => b.active && b.motion === 'chappyYoyo')!;
  const yoyo = normal.bullets.objects.find((b) => b.active && b.motion === 'chappyYoyo')!;
  for (let i = 0; i < 60; i++) { easy.update(); normal.update(); }
  expect(easyYoyo.y).toBe(132); expect(yoyo.y).toBeGreaterThan(132);
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

it('最終技は再演を使わず、99秒の時間切れで取得失敗として戦闘後会話へ進む', () => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    const game = start(3, 9, false, difficulty);
    const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
    expect(claudineScene(game)).toBe('responsiveBloom');
    expect(game.phase?.name).toBe('レスポンシブ・ブルーム');
    let maxCount = 0;
    while (game.phaseFrame < 5939) {
      game.update(); maxCount = Math.max(maxCount, game.bullets.count);
      expect(game.bullets.objects.every((b) => !b.active || b.motion === 'bloomRocket' || b.motion === 'bloomSpark')).toBe(true);
    }
    expect(maxCount).toBeGreaterThan(50);
    expect(maxCount).toBeLessThan(700);
    expect(game.phase?.pattern).toBe('final');
    const score = game.score; game.update();
    expect(game.phase).toBeUndefined();
    expect(game.score).toBe(score); expect(play).not.toHaveBeenCalledWith('capture');
    expect(game.collectionFrames).toBe(0);
    expect(game.transition).toBe('boss-defeat-flash');
    expect(game.bullets.count).toBe(0);
    for (let i = 0; i < 8 + 90 + 60 + 120; i++) game.update();
    expect(game.scene).toBe('dialogue');
  }
});

it('5面中ボスはエトキチの3技を使い、ネオのキーやVimを再演しない', () => {
  const game = start(5, 0, true);
  for (let index = 0; index < 3; index++) {
    for (let frame = 0; game.phaseIntro && frame < 480; frame++) game.update();
    expect(game.phaseIntro).toBeUndefined();
    expect(game.remainingSpells).toBe(3 - index);
    game.phaseFrame = 104;
    game.update();
    expect(game.bullets.count).toBeGreaterThan(0);
    expect(game.vimAttack).toBeUndefined();
    expect(game.keyboardWord).toBe('');
    expect(game.bullets.objects.some((b) => b.active && b.keyLabel)).toBe(false);
    game.skipPhase();
  }
  expect(game.remainingSpells).toBe(0);
});

it('グラフはノートから枝を伸ばし、タグ弾は対応する色の魔法陣へ曲がる', () => {
  const link = start(2, 3);
  const root = link.graphNodes[0];
  expect(root.warning).toBeGreaterThan(root.age);
  for (let i = 0; i < 67; i++) link.update();
  expect(link.graphNodes.length).toBeGreaterThan(1);
  expect(link.graphEdges[0].from).toBe(root);
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
  ] as const) {
    const easy = start(stage, phase, mid, 'easy').bullets.objects.find((b) => b.active && b.motion === motion)!;
    const lunatic = start(stage, phase, mid, 'lunatic').bullets.objects.find((b) => b.active && b.motion === motion)!;
    expect(easy.delay || easy.releaseAt, motion).toBeGreaterThan(lunatic.delay || lunatic.releaseAt);
  }
  expect(start(2, 3, false, 'easy').graphNodes[0].warning).toBeGreaterThan(start(2, 3, false, 'lunatic').graphNodes[0].warning);
  expect(vimScene(0, 0).warning).toBeGreaterThan(vimScene(0, 3).warning);
});
