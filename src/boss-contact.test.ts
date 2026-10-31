import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { DASH_ATTACK, DASH_MOVE, ISSEN_RECOVERY, issenScene } from './patterns/jinrai-issen';

const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void> = {};
beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof listeners[string]) => { listeners[kind] = listener; } });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fight(stage: number, mid = false): Game {
  const game = new Game(); game.audio.volume = 0;
  game.startStage(stage); game.startBoss(mid, 0);
  game.phaseFrame = 200; game.cutin = 0; game.invulnFrames = 0; game.lives = 3;
  return game;
}
function run(game: Game, frames: number): void { for (let i = 0; i < frames; i++) game.update(); }
function directHit(): Game {
  const game = fight(4); game.startBoss(false, 10);
  const state = game.jinraiIssen!;
  state.origin = [80, 100]; state.end = [300, 424]; state.aim = [260, 360];
  game.phaseFrame = DASH_ATTACK + DASH_MOVE - 1;
  game.px = 300; game.py = 424;
  return game;
}

it.each([1, 2, 3, 4, 5])('%s面のボスと中ボスに触れると1機失い、無敵中は重ねて失わない', stage => {
  for (const mid of [false, true]) {
    const game = fight(stage, mid);
    [game.px, game.py] = game.bossXY;
    game.update(); expect(game.pendingHit).toBe(1);
    run(game, 7); expect(game.lives).toBe(2); expect(game.invulnFrames).toBe(180);
    run(game, 30); expect(game.lives).toBe(2);
  }
});

it('一閃直撃とボス接触が重なっても、被弾1回でちょうど2機失う', () => {
  const game = directHit();
  game.update(); expect(game.pendingHit).toBe(1); expect(game.lives).toBe(3);
  run(game, 7);
  expect(game.lives).toBe(1); expect(game.invulnFrames).toBe(180);
  run(game, 30); expect(game.lives).toBe(1);
});

it('本体接触の被弾猶予中に一閃が直撃した場合も、計2機分として扱う', () => {
  const game = directHit();
  game.phaseFrame = DASH_ATTACK - 2;
  [game.px, game.py] = game.jinraiIssen!.origin;
  game.update(); expect(game.pendingHit).toBe(1);
  run(game, 7);
  expect(game.lives).toBe(1);
});

it('一閃の2機分も喰らいボムで取り消せ、次の普通の被弾へ持ち越さない', () => {
  const game = directHit(); game.bombs = 1;
  game.update();
  listeners.keydown({ code: 'KeyX', repeat: false, preventDefault: () => {} }); game.update();
  listeners.keyup({ code: 'KeyX', repeat: false, preventDefault: () => {} });
  expect(game.pendingHit).toBe(-1); expect(game.lives).toBe(3); expect(game.bombs).toBe(0);
  game.bombFrames = 0; game.invulnFrames = 0; game.px = 40; game.py = 400;
  game.queueHit(); run(game, 8);
  expect(game.lives).toBe(2);
});

it('一閃で残機が尽きたらゲームオーバーになり、リトライ後の普通の被弾は1機になる', () => {
  const game = directHit(); game.lives = 0;
  run(game, 8); expect(game.scene).toBe('gameover');
  game.startStage(4); game.startBoss(false, 0);
  game.phaseFrame = 200; game.cutin = 0; game.invulnFrames = 0;
  const before = game.lives;
  [game.px, game.py] = game.bossXY; run(game, 8);
  expect(game.lives).toBe(before - 1);
});

it.each(['invincible', 'invulnerable', 'cutin'] as const)('ボス接触は無敵やカットインを無視しない: %s', mode => {
  const game = fight(3);
  if (mode === 'invincible') game.invincible = true;
  if (mode === 'invulnerable') game.invulnFrames = 20;
  if (mode === 'cutin') game.cutin = 40;
  [game.px, game.py] = game.bossXY;
  game.update(); expect(game.pendingHit).toBe(-1);
});

it('転移で透明な迅雷に触れても被弾しない', () => {
  const game = directHit();
  game.phaseFrame = DASH_ATTACK + ISSEN_RECOVERY + 15;
  game.jinraiIssen!.hops = [[180, 300]];
  expect(issenScene(game)?.opacity).toBe(0);
  [game.px, game.py] = game.bossXY;
  game.update(); expect(game.pendingHit).toBe(-1);
});
