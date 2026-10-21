import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { emitMinerva } from './patterns/minerva';
import { gravityScene, socraticScene } from './patterns/minerva-inquiry';
import { density } from './rules';

const difficulties = ['easy', 'normal', 'hard', 'lunatic'] as const;
const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void> = {};
beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof listeners[string]) => { listeners[kind] = listener; } });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function fight(index: number, difficulty: Game['difficulty']): Game {
  const game = new Game(); game.audio.volume = 0; game.difficulty = difficulty;
  game.startStage(5); game.startBoss(false, index); game.invincible = true;
  return game;
}

it.each(difficulties)('推論の門は%sで2回たどった唯一の答えを持ち、不正解の門だけに予告弾を作る', difficulty => {
  const game = fight(3, difficulty);
  for (let wave = 0; wave < 18; wave++) {
    const period = socraticScene(105, difficulty).period;
    const scene = socraticScene(105 + wave * period, difficulty);
    expect(new Set(scene.gates).size).toBe(3);
    expect(scene.gates[scene.lane]).toBe(scene.mapping[scene.mapping[scene.source]]);
    expect(scene.answer).not.toBe(scene.source);
    expect(scene.answer).not.toBe(scene.mapping[scene.source]);
    game.bullets.clear(); game.phaseFrame = 105 + wave * period + scene.reveal;
    emitMinerva(game, 'question');
    const bullets = game.bullets.objects.filter(b => b.active);
    expect(bullets.length).toBeGreaterThan(80);
    expect(bullets.every(b => Math.floor(b.x / 128) !== scene.lane && b.delay === scene.grace)).toBe(true);
    // 反対端からも解答の門まで通常移動で到達できる。
    expect(scene.reveal + scene.grace).toBeGreaterThan(320 / 3.65);
  }
});

it.each(difficulties)('重力は%sで予告中に動かず、4方向とも低速入力で抗え、ポーズ中は止まる', difficulty => {
  const game = fight(5, difficulty);
  for (let wave = 0; wave < 4; wave++) {
    const base = 105 + wave * 480;
    const warning = gravityScene(base, difficulty).warning;
    game.phaseFrame = base - 1; game.px = 192; game.py = 320; game.keys.clear();
    game.update(); expect([game.px, game.py]).toEqual([192, 320]);
    const scene = gravityScene(base + warning + 30, difficulty);
    game.phaseFrame = base + warning + 29; game.update();
    expect(game.px - 192).toBeCloseTo(scene.dx * scene.force);
    expect(game.py - 320).toBeCloseTo(scene.dy * scene.force);
    game.px = 192; game.py = 320; game.keys.add('ShiftLeft');
    game.keys.add(scene.dx > 0 ? 'ArrowLeft' : scene.dx < 0 ? 'ArrowRight' : scene.dy > 0 ? 'ArrowUp' : 'ArrowDown');
    game.update();
    expect((game.px - 192) * scene.dx + (game.py - 320) * scene.dy).toBeLessThan(0);
    game.scene = 'pause'; const position = [game.px, game.py], frame = game.phaseFrame;
    game.keys.clear(); game.update(); expect([game.px, game.py]).toEqual(position); expect(game.phaseFrame).toBe(frame);
    game.scene = 'stage';
  }
  game.startBoss(false, 7); game.px = 192; game.py = 320; game.keys.clear(); game.update();
  expect([game.px, game.py]).toEqual([192, 320]);
});

it.each(difficulties)('リトラクションは%sで全周の等間隔弾を省略せず放つ', difficulty => {
  const game = fight(9, difficulty); game.phaseFrame = 105; emitMinerva(game, 'recall');
  const bullets = game.bullets.objects.filter(b => b.active && b.motion === 'recall');
  expect(bullets).toHaveLength(density(difficulty, 40));
  const angles = bullets.map(b => (Math.atan2(b.vy, b.vx) + Math.PI * 2) % (Math.PI * 2)).sort((a, b) => a - b);
  for (let i = 0; i < angles.length; i++) {
    const next = i + 1 === angles.length ? angles[0] + Math.PI * 2 : angles[i + 1];
    expect(next - angles[i]).toBeCloseTo(Math.PI * 2 / angles.length);
  }
});
