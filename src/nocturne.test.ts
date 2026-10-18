import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { enemyPose } from './enemy-design';
import { type Enemy, Game } from './game';
import { MID_PHASE, STAGES } from './stages';

const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void> = {};
let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('location', { search: '?bgm=0' });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof listeners[string]) => { listeners[kind] = listener; } });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());

function press(game: Game, code: string): void {
  listeners.keydown({ code, repeat: false, preventDefault: () => {} });
  game.update();
  listeners.keyup({ code, repeat: false, preventDefault: () => {} });
}

function game(): Game {
  const g = new Game(); g.audio.volume = 0; g.invincible = true;
  return g;
}

function clear(g: Game, stage: number): void {
  g.startStage(stage); g.startBoss(false, STAGES[stage - 1].phases.length - 1); g.skipPhase();
  while (g.collectionFrames > 0) g.update();
  expect(g.scene).toBe('dialogue');
  for (let i = 0; i < g.lines.length; i++) press(g, 'KeyZ');
  expect(g.scene).toBe('clear');
}

it('中ボスでは記録を獲得せず、ボス後の会話を終えたときに獲得する', () => {
  const g = game(); g.startStage(1); g.startBoss(true, 0); g.skipPhase(); g.skipPhase();
  while (g.collectionFrames > 0) g.update();
  for (let i = 0; i < g.lines.length; i++) press(g, 'KeyZ');
  expect(g.collectedRecords).toEqual([]);
  g.startBoss(false, 6); g.skipPhase();
  while (g.collectionFrames > 0) g.update();
  expect(g.collectedRecords).toEqual([]);
  for (let i = 0; i < g.lines.length; i++) press(g, 'KeyZ');
  expect(g.collectedRecords).toEqual([1]);
  expect(storage.get('owlery-records')).toBe('1');
});

it('5階の記録を順不同で集めても保存は昇順で、再クリアと再起動で重複しない', () => {
  const g = game();
  for (const stage of [4, 1, 3, 2, 5, 3]) clear(g, stage);
  expect(g.collectedRecords).toEqual([1, 2, 3, 4, 5]);
  expect(storage.get('owlery-records')).toBe('1,2,3,4,5');
  expect(game().collectedRecords).toEqual([1, 2, 3, 4, 5]);
});

it('不正な保存値を無視して既存の練習解放とスコアを維持する', () => {
  storage.set('owlery-records', '5,1,1,NaN,0,6,2.5,3,Infinity');
  storage.set('owlery-unlocked', '4'); storage.set('owlery-high-normal', '123456');
  const g = game();
  expect(g.collectedRecords).toEqual([1, 3, 5]);
  expect(g.unlockedStages).toBe(4);
  g.startStage(1); expect(g.highScore).toBe(123456);
});

it('タイトルの5番目からノートを開き、未獲得頁も選べ、戻ってゲームを始められる', () => {
  const g = game();
  for (let i = 0; i < 4; i++) press(g, 'ArrowDown');
  expect(g.menu).toBe(4);
  press(g, 'KeyZ'); expect(g.scene).toBe('notebook'); expect(g.bgm.cue).toBe('title');
  press(g, 'ArrowUp'); expect(g.menu).toBe(4);
  press(g, 'ArrowDown'); expect(g.menu).toBe(0);
  press(g, 'KeyX'); expect(g.scene).toBe('title'); expect(g.menu).toBe(0);
  press(g, 'KeyZ'); press(g, 'KeyZ'); expect(g.scene).toBe('stage');
});

it('ノートのZとEscは選択をリセットして戻り、保存不可でもクリアできる', () => {
  const g = game();
  for (const code of ['KeyZ', 'Escape']) {
    g.scene = 'notebook'; g.menu = 4; press(g, code);
    expect(g.scene).toBe('title'); expect(g.menu).toBe(0);
  }
  vi.stubGlobal('localStorage', { getItem: () => { throw Error('disabled'); }, setItem: () => { throw Error('disabled'); } });
  clear(g, 2); expect(g.collectedRecords).toEqual([2]);
});

function foe(g: Game, kind: Enemy['kind'], slot = 0): Enemy {
  const e = g.enemies.acquire()!;
  Object.assign(e, { x: 192, y: 100, originX: 192, originY: -20, side: 1, hp: 100, age: 0, hitFrames: 0, kind, slot });
  return e;
}

it('発射直前は準備の姿になり、発射後は通常へ戻り、被弾の姿を優先する', () => {
  const g = game(); g.startStage(2);
  const e = foe(g, 'threeWay'); e.age = 73;
  expect(enemyPose(e, 2, g.px, g.py)).toBe(1);
  g.stageFrame = 1000;
  while (e.age < 95) g.update();
  expect(g.bullets.count).toBe(3);
  g.update(); expect(enemyPose(e, 2, g.px, g.py)).toBe(0);
  const shot = g.shots.acquire()!;
  Object.assign(shot, { x: e.x, y: e.y + 10, vx: 0, vy: -10, radius: 3, damage: 1, homing: false });
  g.update(); expect(e.hp).toBe(99); expect(enemyPose(e, 2, g.px, g.py)).toBe(2);
  for (let i = 0; i < 8; i++) g.update();
  expect(enemyPose(e, 2, g.px, g.py)).toBe(0);
});

it('交差編隊の2回の発射を予告し、近距離と発射しない編隊には予告しない', () => {
  const g = game(); g.startStage(1); const e = foe(g, 'cross', 6);
  for (const age of [44, 104]) { e.age = age; expect(enemyPose(e, 1, 192, 398)).toBe(1); }
  e.age = 90; expect(enemyPose(e, 1, 192, 398)).toBe(0);
  e.age = 44; expect(enemyPose(e, 1, e.x, e.y + 149)).toBe(0);
  const quiet = foe(g, 'return', 6); quiet.age = 90;
  expect(enemyPose(quiet, 1, 192, 398)).toBe(0);
});

it('全ボス・中ボスの技名から○符の形式を除く', () => {
  for (const phase of [...STAGES.flatMap((s) => s.phases), ...Object.values(MID_PHASE)]) {
    expect(phase.name).not.toContain('符「');
  }
});
