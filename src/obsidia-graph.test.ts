import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { GRAPH_BEAT, GRAPH_COUNT, GRAPH_FADE, GRAPH_LINE_WIDTH, GRAPH_PERIOD, GRAPH_WARNING, type GraphEdge, graphEdgeDistance, graphEdgeState, graphNodeState } from './patterns/obsidia-graph';

let keydown: (event: { code: string; repeat: boolean; preventDefault: () => void }) => void;
beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: (name: string, listener: typeof keydown) => { if (name === 'keydown') keydown = listener; } });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => vi.unstubAllGlobals());

function start(difficulty: Game['difficulty'] = 'normal'): Game {
  const game = new Game(); game.audio.volume = 0; game.difficulty = difficulty; game.invincible = true;
  game.startStage(2); game.startBoss(false, 3); game.phaseFrame = 104; game.invulnFrames = 0;
  return game;
}
function advance(game: Game, frames: number): void { for (let i = 0; i < frames; i++) game.update(); }
function press(game: Game, code: string): void {
  keydown({ code, repeat: false, preventDefault: () => {} }); game.update(); game.keys.delete(code);
}

it('4難易度でノートと線が画面全域へ増え、12秒で重ならず育ち直す', () => {
  for (const [level, difficulty] of (['easy', 'normal', 'hard', 'lunatic'] as const).entries()) {
    const game = start(difficulty); game.update(); const root = game.graphNodes[0];
    expect(game.graphNodes).toHaveLength(1); expect(game.graphEdges).toHaveLength(0);
    advance(game, GRAPH_BEAT[level] * (GRAPH_COUNT[level] - 1));
    expect(game.graphNodes.length).toBeLessThanOrEqual(GRAPH_COUNT[level]);
    expect(game.graphNodes.length).toBeGreaterThan(GRAPH_COUNT[level] * 0.6);
    expect(game.graphEdges.length).toBeGreaterThan(GRAPH_COUNT[level] * 0.5);
    const xs = game.graphNodes.map(node => node.x); const ys = game.graphNodes.map(node => node.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(280);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(300);
    expect(game.bullets.count).toBe(0);
    advance(game, GRAPH_PERIOD - game.graphFrame);
    expect(game.graphNodes).toHaveLength(0); expect(game.graphEdges).toHaveLength(0);
    game.update(); expect(game.graphNodes).toHaveLength(1); expect(game.graphNodes[0]).not.toBe(root);
    expect(game.graphFrame).toBe(GRAPH_PERIOD + 1);
    advance(game, GRAPH_PERIOD * 3);
    expect(game.graphNodes).toHaveLength(1); expect(game.graphEdges).toHaveLength(0);
  }
});

it('ノートは予告中に触れても無害で、実体化とSEの直後から被弾する', () => {
  const game = start(); game.invincible = false; game.px = 192; game.py = 104;
  const play = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  advance(game, GRAPH_WARNING[1]);
  expect(game.pendingHit).toBe(-1); expect(graphNodeState(game.graphNodes[0])).toBe('warning');
  expect(play).not.toHaveBeenCalledWith('enemyShot');
  game.update(); expect(game.pendingHit).toBe(1); expect(game.hitDuringSpell).toBe(true);
  expect(graphNodeState(game.graphNodes[0])).toBe('active'); expect(play).toHaveBeenCalledWith('enemyShot');
});

it('連続線分の中間・端点・斜線を判定し、線を越えた場所は当たらない', () => {
  const game = start(); advance(game, 120); const edge = game.graphEdges[0];
  const x = (edge.from.x + edge.to.x) / 2; const y = (edge.from.y + edge.to.y) / 2;
  expect(graphEdgeDistance(edge, x, y)).toBeCloseTo(0);
  expect(graphEdgeDistance(edge, edge.from.x, edge.from.y)).toBeCloseTo(0);
  game.px = x; game.py = y; game.invincible = false;
  game.update(); expect(game.pendingHit).toBe(1);
  game.pendingHit = -1;
  const dx = edge.to.x - edge.from.x; const dy = edge.to.y - edge.from.y; const length = Math.hypot(dx, dy);
  game.px = x - dy / length * 6; game.py = y + dx / length * 6;
  game.update(); expect(game.pendingHit).toBe(-1);
  const pointEdge: GraphEdge = { from: edge.from, to: edge.from, grazed: false };
  expect(graphEdgeDistance(pointEdge, edge.from.x + 3, edge.from.y + 4)).toBeCloseTo(5);
});

it('ノートとリンクのグレイズは各1回で、消え始めた網は無害になる', () => {
  const game = start(); advance(game, 120); const edge = game.graphEdges[0];
  const dx = edge.to.x - edge.from.x; const dy = edge.to.y - edge.from.y; const length = Math.hypot(dx, dy);
  game.px = (edge.from.x + edge.to.x) / 2 - dy / length * 10;
  game.py = (edge.from.y + edge.to.y) / 2 + dx / length * 10;
  game.invincible = false; const graze = game.graze;
  advance(game, 3); expect(game.graze).toBe(graze + 1); expect(edge.grazed).toBe(true);
  game.graphEdges.splice(1);
  game.px = 192; game.py = 116; advance(game, 3); expect(game.graze).toBe(graze + 2);
  game.invincible = true;
  advance(game, GRAPH_PERIOD - GRAPH_FADE - game.graphFrame);
  expect(graphEdgeState(edge)).toBe('fading');
  game.px = edge.from.x; game.py = edge.from.y; game.invincible = false;
  game.update(); expect(game.pendingHit).toBe(-1);
});

it('自機への枝は予告開始位置で固定され、その場に居続けると当たる', () => {
  const game = start(); game.px = 209; game.py = 397;
  advance(game, GRAPH_BEAT[1] * 7 + 1);
  const node = game.graphNodes[7]; expect([node.x, node.y]).toEqual([209, 397]);
  game.px = 300; game.py = 380; advance(game, GRAPH_WARNING[1]);
  expect([node.x, node.y]).toEqual([209, 397]);
  game.px = node.x; game.py = node.y; game.invincible = false;
  game.update(); expect(game.pendingHit).toBe(1);
});

it('四隅と下半分の代表点に居続けても、全難易度で枝が届く', () => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    for (const x of [9, 96, 192, 288, 375]) for (const y of [12, 260, 340, 398, 439]) {
      const game = start(difficulty); game.invincible = false; game.px = x; game.py = y;
      while (game.graphFrame < 300 && game.pendingHit < 0) game.update();
      expect(game.pendingHit, `${difficulty} at ${x},${y}`).toBeGreaterThanOrEqual(0);
    }
  }
});

it('ボム中は再生成せず、ボム明けは消えた親を参照せず種から始める', () => {
  const game = start(); advance(game, 360); expect(game.graphEdges.length).toBeGreaterThan(0);
  const old = [...game.graphNodes]; press(game, 'KeyX');
  expect(game.graphNodes).toHaveLength(0); expect(game.graphEdges).toHaveLength(0); expect(game.graphFrame).toBe(0);
  while (game.bombFrames > 1) { game.update(); expect(game.graphNodes).toHaveLength(0); }
  game.update(); expect(game.graphNodes).toHaveLength(1); expect(game.graphEdges).toHaveLength(0);
  advance(game, 100);
  expect(game.graphEdges.every(edge => !old.includes(edge.from) && !old.includes(edge.to))).toBe(true);
});

it('壁際のノートを親にも子にも接続せず、壁から壁へリンクを張らない', () => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    const game = start(difficulty);
    const positions = [[9, 250], [375, 250], [192, 12], [192, 439]];
    for (let i = 0; i < 600; i++) {
      [game.px, game.py] = positions[Math.floor(i / 28) % positions.length];
      game.update();
    }
    const wall = game.graphNodes.filter(node => node.x < 32 || node.x > 352 || node.y < 32 || node.y > 416);
    expect(wall.length).toBeGreaterThan(0);
    expect(game.graphEdges.every(edge => !wall.includes(edge.from) && !wall.includes(edge.to))).toBe(true);
    expect(game.graphEdges.length).toBeGreaterThan(0);
  }
});

it('予告線や実線へノートが育つ前に古い枝をほどき、輪を閉じない', () => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) for (const warning of [false, true]) {
    const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(difficulty);
    const game = start(difficulty); advance(game, GRAPH_BEAT[level] * 7);
    const old = warning ? game.graphEdges.at(-1)! : game.graphEdges[0];
    expect(graphEdgeState(old)).toBe(warning ? 'warning' : 'active');
    game.px = (old.from.x + old.to.x) / 2; game.py = (old.from.y + old.to.y) / 2;
    game.update();
    const node = game.graphNodes[7];
    expect([node.x, node.y]).toEqual([game.px, game.py]);
    expect(graphEdgeState(old)).toBe('fading');
    for (const edge of game.graphEdges) {
      if (edge.to === node || graphEdgeState(edge) === 'fading') continue;
      expect(graphEdgeDistance(edge, node.x, node.y) - node.radius - GRAPH_LINE_WIDTH / 2).toBeGreaterThan(6);
    }
    for (const other of game.graphNodes) {
      if (other === node || graphNodeState(other) === 'fading') continue;
      expect(Math.hypot(other.x - node.x, other.y - node.y) - other.radius - node.radius).toBeGreaterThan(6);
    }
  }
});

// 自機中心が通れる領域を4px格子で塗りつぶす。細い網の端に生じる格子数個の
// 誤差は除き、画面の一部が閉じた大きな区画になる退行を検出する。
function isolatedArea(game: Game): number {
  const width = 92; const height = 107;
  const free = new Uint8Array(width * height);
  const nodes = game.graphNodes.filter(node => graphNodeState(node) === 'active');
  const edges = game.graphEdges.filter(edge => graphEdgeState(edge) === 'active');
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    const x = 9 + col * 4; const y = 12 + row * 4;
    if (nodes.some(node => (x - node.x) ** 2 + (y - node.y) ** 2 <= (node.radius + 2.5) ** 2)) continue;
    if (edges.some(edge => graphEdgeDistance(edge, x, y) <= GRAPH_LINE_WIDTH / 2 + 2.5)) continue;
    free[row * width + col] = 1;
  }
  let total = 0; let largest = 0;
  for (let origin = 0; origin < free.length; origin++) {
    if (!free[origin]) continue;
    const stack = [origin]; free[origin] = 0; let size = 0;
    while (stack.length) {
      const at = stack.pop()!; size++;
      const col = at % width;
      for (const next of [col > 0 ? at - 1 : -1, col < width - 1 ? at + 1 : -1, at - width, at + width]) {
        if (next < 0 || next >= free.length || !free[next]) continue;
        free[next] = 0; stack.push(next);
      }
    }
    total += size; largest = Math.max(largest, size);
  }
  return total - largest;
}

it('壁沿いと内部の不規則な移動でも、2周期を通して広い区画を閉じない', () => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) for (const strategy of [0, 1, 3, 7, 11, 13]) {
    const game = start(difficulty);
    let seed = strategy; let x = 192; let y = 400;
    const random = (): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let frame = 0; frame < GRAPH_PERIOD * 2; frame++) {
      const step = strategy === 7 ? 14 : 8;
      x = Math.max(9, Math.min(375, x + (random() - 0.5) * step));
      y = Math.max(12, Math.min(439, y + (random() - 0.5) * step));
      game.px = strategy === 0 ? Math.floor(frame / 90) % 2 ? 375 : 9 : strategy === 1 ? 9 + frame * 1.3 % 366 : x;
      game.py = strategy === 0 ? 250 : strategy === 1 ? 439 : y;
      game.update();
      if (frame % 120 === 30 || [320, 490, 1300].includes(frame)) expect(isolatedArea(game), `${difficulty}, strategy=${strategy}, frame=${frame}`).toBeLessThan(32);
    }
  }
});

it('ポーズは成長と判定を止め、やり直しと次フェーズは専用状態を消す', () => {
  const game = start(); advance(game, 360);
  press(game, 'Escape');
  const before = JSON.stringify(game.graphNodes); const clock = game.graphFrame;
  advance(game, 60); expect(game.graphFrame).toBe(clock); expect(JSON.stringify(game.graphNodes)).toBe(before);
  press(game, 'Escape'); game.update();
  expect(game.graphFrame).toBe(clock + 1);
  const nodes = [...game.graphNodes]; game.skipPhase();
  expect(game.graphNodes).toHaveLength(0); expect(game.graphEdges).toHaveLength(0); expect(game.graphFrame).toBe(0);
  expect(nodes.every(node => game.items.objects.some(item => item.active && item.kind === 'point' && item.x === node.x && item.y === node.y))).toBe(true);
  game.startBoss(false, 3); game.phaseFrame = 104; advance(game, 240);
  expect(game.graphNodes.length).toBeGreaterThan(0);
  game.startStage(2); expect(game.graphNodes).toHaveLength(0); expect(game.graphEdges).toHaveLength(0);
});
