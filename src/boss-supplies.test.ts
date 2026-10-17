import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { STAGES } from './stages';

const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void> = {};

beforeEach(() => {
  // 回収操作を決定的に検証し、散布の確率評価をCIへ持ち込まない。
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof listeners[string]) => { listeners[kind] = listener; } });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function start(stage = 1, phase = 0, mid = false): Game {
  const game = new Game();
  game.audio.volume = 0;
  game.startStage(stage);
  game.startBoss(mid, phase);
  return game;
}

function collectDuringOpening(game: Game): void {
  for (let i = 0; i < 104; i++) game.update();
}

function recoverDroppedPower(game: Game): void {
  game.keys.add('ShiftLeft');
  for (let i = 0; i < 170; i++) {
    const target = game.items.objects.filter((item) => item.active && (item.kind === 'large' || item.kind === 'small'))
      .sort((a, b) => Math.hypot(a.x - game.px, a.y - game.py) - Math.hypot(b.x - game.px, b.y - game.py))[0];
    if (!target) break;
    for (const [key, held] of [
      ['ArrowLeft', target.x < game.px - 1], ['ArrowRight', target.x > game.px + 1],
      ['ArrowUp', target.y < game.py - 1], ['ArrowDown', target.y > game.py + 1],
    ] as const) {
      if (held) game.keys.add(key); else game.keys.delete(key);
    }
    game.update();
  }
}

it('被弾後の無敵時間内に失ったPowerを回収でき、所持ボムは減らない', () => {
  const game = start();
  game.power = 4;
  game.bombs = 6;
  game.pendingHit = 7;
  game.update();
  expect(game.power).toBe(3);
  expect(game.bombs).toBe(6);
  expect(game.lives).toBe(1);
  expect(game.items.objects.filter((item) => item.active && item.kind === 'large').every((item) => Math.hypot(item.x - game.px, item.y - game.py) > 84)).toBe(true);
  recoverDroppedPower(game);
  expect(game.power).toBe(4);
  expect(game.invulnFrames).toBeGreaterThan(0);
  expect(game.lives).toBe(1);
});

it.each([0, 0.05, 0.35, 0.95])('Power %sでの被弾から元の量だけ回収できる', (power) => {
  const game = start();
  game.power = power;
  game.bombs = 0;
  game.pendingHit = 7;
  game.update();
  expect(game.power).toBe(0);
  expect(game.bombs).toBe(3);
  recoverDroppedPower(game);
  expect(game.power).toBeCloseTo(power);
});

it('喰らいボムではPowerを失わず、被弾時の回収品も出ない', () => {
  const game = start();
  game.power = 4;
  game.pendingHit = 7;
  listeners.keydown({ code: 'KeyX', repeat: false, preventDefault: () => {} });
  game.update();
  expect(game.power).toBe(4);
  expect(game.lives).toBe(2);
  expect(game.bombs).toBe(2);
  expect(game.items.count).toBe(0);
});

it('通常攻撃後にPower、2フェーズ終了後にPowerとボムを攻撃再開前に回収する', () => {
  const game = start();
  game.bombs = 0;
  game.phaseHp = 0;
  game.update();
  expect(game.items.objects.some((item) => item.active && item.kind === 'large' && item.auto)).toBe(true);
  collectDuringOpening(game);
  expect(game.power).toBe(1);
  expect(game.bombs).toBe(0);
  game.phaseHp = 0;
  game.update();
  collectDuringOpening(game);
  expect(game.power).toBe(2);
  expect(game.bombs).toBe(1);
});

it('撃破できず時間切れになったフェーズでも補充を受けられる', () => {
  const game = start(1, 1);
  game.bombs = 0;
  game.phaseFrame = game.phase!.duration * 60 - 1;
  game.update();
  expect(game.phaseIndex).toBe(2);
  collectDuringOpening(game);
  expect(game.power).toBe(1);
  expect(game.bombs).toBe(1);
  expect(game.message).not.toBe('技の記録ボーナス！');
});

it('弾消しで点アイテムがプールを埋めても補充品を優先する', () => {
  const game = start(1, 1);
  game.bombs = 0;
  for (let i = 0; i < 2600; i++) game.spawnBullet(192, 120, 0, 0, 0, 'orb');
  game.phaseHp = 0;
  game.update();
  collectDuringOpening(game);
  expect(game.power).toBe(1);
  expect(game.bombs).toBe(1);
});

it('全ステージの中ボスと最終フェーズで会話や次の面に補充を取り残さない', () => {
  for (let stage = 1; stage <= STAGES.length; stage++) {
    for (const mid of [true, false]) {
      const index = mid ? 0 : STAGES[stage - 1].phases.length - 1;
      const game = start(stage, index, mid);
      game.bombs = 0;
      game.power = 3;
      game.skipPhase();
      expect(game.phase).toBeUndefined();
      expect(game.power).toBe(4);
      expect(game.bombs).toBe(mid || index % 2 === 1 ? 1 : 0);
    }
  }
});

it('5面中ボスの時間延長はフェーズ終了まで補充を増やさない', () => {
  const game = start(5, 0, true);
  game.invincible = true;
  game.bombs = 0;
  for (let i = 0; i < 3; i++) {
    game.phaseFrame = game.phase!.duration * 60 - 1;
    game.update();
    expect(game.power).toBe(0);
    expect(game.bombs).toBe(0);
  }
  game.phaseFrame = game.phase!.duration * 60 - 1;
  game.update();
  expect(game.power).toBe(1);
  expect(game.bombs).toBe(1);
});

it('補充はPower4・ボム8の上限を超えず、被弾でも備蓄を失わない', () => {
  const game = start(3, 0, true);
  game.power = 4;
  game.bombs = 8;
  game.skipPhase();
  expect(game.power).toBe(4);
  expect(game.bombs).toBe(8);
  game.startBoss(false, 1);
  game.pendingHit = 7;
  game.update();
  expect(game.bombs).toBe(8);
});
