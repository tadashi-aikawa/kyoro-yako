import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { CHAPPY_THROW, CODEX_PERIOD, CODEX_WARNING } from './patterns/chappy';
import { midPhases } from './stages';

const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void> = {};
beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof listeners[string]) => { listeners[kind] = listener; } });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function start(index = 0, difficulty: Game['difficulty'] = 'normal'): Game {
  const game = new Game(); game.audio.volume = 0; game.difficulty = difficulty;
  game.startStage(3); game.startBoss(true, index); game.phaseFrame = 104; game.update();
  return game;
}
function run(game: Game, frames: number): void { for (let i = 0; i < frames; i++) game.update(); }

it('3技へ直行でき、合計HPはPower3の理論40秒未満に収まる', () => {
  expect(midPhases('chappy').map((p) => p.pattern)).toEqual(['codex', 'chappyParallel', 'chappyDelivery']);
  expect(midPhases('chappy').reduce((sum, p) => sum + p.hp, 0) / 48.6).toBeLessThan(40);
  for (let index = 0; index < 3; index++) {
    vi.stubGlobal('location', { search: `?boss=3&mid=1&phase=${index}` });
    const game = new Game();
    expect(game.phase).toBe(midPhases('chappy')[index]);
    expect(game.remainingSpells).toBe(3 - index);
  }
});

it('各技の時間切れで補充し、3→2→1→0のあとに回収・会話・道中へ進む', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.9);
  const game = start(); game.invincible = true;
  const stageFrame = game.stageFrame;
  for (let index = 0; index < 3; index++) {
    for (let frame = 0; game.phaseIntro && frame < 300; frame++) game.update();
    expect(game.phaseIntro).toBeUndefined();
    game.items.clear();
    game.phaseFrame = game.phase!.duration * 60 - 1; game.update();
    expect(game.items.objects.filter((i) => i.active && i.manual && i.kind === 'small')).toHaveLength(10);
    expect(game.remainingSpells).toBe(2 - index);
    expect(game.bullets.count).toBe(0);
    expect(game.stageFrame).toBe(stageFrame);
  }
  expect(game.phase).toBeUndefined(); expect(game.collectionFrames).toBe(180);
  run(game, 180); expect(game.scene).toBe('dialogue');
  game.keys.add('ControlLeft'); run(game, 30);
  expect(game.scene).toBe('stage'); expect(game.boss).toBeUndefined();
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sの箱は着地後に左右が時間差で4斉射ずつ出す', (difficulty) => {
  const game = start(0, difficulty); game.invincible = true;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
  const boxes = game.bullets.objects.filter((b) => b.active && b.motion === 'codexBox');
  expect(boxes).toHaveLength(2);
  expect(CODEX_WARNING[level]).toBeGreaterThan(CHAPPY_THROW);
  run(game, CHAPPY_THROW - 1);
  expect(boxes.map((b) => [b.x, b.y])).toEqual([[96, 148], [288, 148]]);
  const interval = [34, 30, 26, 22][level];
  run(game, CODEX_WARNING[level] - CHAPPY_THROW - 1);
  expect(game.bullets.objects.filter((b) => b.active && b.motion === 'normal')).toHaveLength(0);
  game.update();
  expect(game.bullets.objects.filter((b) => b.active && b.motion === 'normal')).toHaveLength([5, 7, 9, 11][level]);
  run(game, 34 + interval * 3 + 18);
  expect(boxes.every((b) => !b.active)).toBe(true);
  expect(game.bullets.objects.filter((b) => b.active && b.motion === 'normal')).toHaveLength([5, 7, 9, 11][level] * 8);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sの完成品は予告後に3色の花火を段階的に開く', (difficulty) => {
  const game = start(2, difficulty); game.invincible = true;
  const seed = game.bullets.objects.find((b) => b.active && b.motion === 'chappyBloom')!;
  run(game, seed.releaseAt - 2);
  expect(game.bullets.objects.filter((b) => b.active && b.motion === 'normal')).toHaveLength(0);
  game.update();
  const first = game.bullets.count;
  expect(first).toBeGreaterThan(15);
  run(game, 44);
  expect(game.bullets.count).toBeGreaterThan(first * 2);
  expect(new Set(game.bullets.objects.filter((b) => b.active && b.motion === 'normal').map((b) => b.color))).toEqual(new Set([1, 2, 3]));
  run(game, 14); expect(seed.active).toBe(false);
});

it.each([0, 2])('技%sのボムは発射源と後続射撃を消す', (index) => {
  const game = start(index);
  listeners.keydown({ code: 'KeyX', repeat: false, preventDefault: () => {} }); game.update(); game.keys.delete('KeyX');
  expect(game.bullets.count).toBe(0);
  run(game, 149);
  expect(game.bullets.count).toBe(0);
  expect(game.phaseFrame - 105).toBeLessThan(CODEX_PERIOD[1]);
});

it('ポーズ中は投げた塊の移動と射撃時計が止まる', () => {
  const game = start();
  const source = game.bullets.objects.find((b) => b.active)!;
  listeners.keydown({ code: 'Escape', repeat: false, preventDefault: () => {} }); game.update(); game.keys.delete('Escape');
  const snapshot = [source.age, source.x, source.y, game.phaseFrame];
  run(game, 60);
  expect([source.age, source.x, source.y, game.phaseFrame]).toEqual(snapshot);
});

it.each(['normal', 'hard', 'lunatic'] as const)('%sのサブエージェント召喚は画面下の中央に留まり続けると当たる', (difficulty) => {
  const game = start(1, difficulty); game.invulnFrames = 0; game.lives = 8;
  game.px = 192; game.py = 393;
  for (let i = 0; i < 1500 && game.pendingHit < 0 && game.lives === 8; i++) game.update();
  expect(game.pendingHit >= 0 || game.lives < 8).toBe(true);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('%sの丸投げは上部の静止にも予告付きの狙い弾を返す', (difficulty) => {
  for (const [x, y] of [[12, 40], [192, 100], [372, 140]]) {
    const game = start(0, difficulty); game.invulnFrames = 0; game.lives = 8; game.px = x; game.py = y;
    for (let i = 0; i < 1500 && game.pendingHit < 0 && game.lives === 8; i++) game.update();
    expect(game.pendingHit >= 0 || game.lives < 8, `${x},${y}`).toBe(true);
  }
});
