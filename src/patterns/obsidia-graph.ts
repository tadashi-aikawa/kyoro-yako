import type { Game } from '../game';
import { FIELD } from '../rules';

export const GRAPH_PERIOD = 720;
export const GRAPH_FADE = 60;
export const GRAPH_LINE_WIDTH = 3;
export const GRAPH_WARNING = [96, 80, 66, 54] as const;
export const GRAPH_BEAT = [26, 20, 16, 14] as const;
export const GRAPH_COUNT = [20, 26, 32, 38] as const;
export interface GraphNode {
  x: number; y: number; radius: number; age: number; warning: number; fadeAt: number;
  color: number; label: string; grazed: boolean; announced: boolean;
}
export interface GraphEdge { from: GraphNode; to: GraphNode; grazed: boolean; }
type GraphState = 'warning' | 'active' | 'fading';

// 上の索引から左右の小さなまとまりを経て、下の余白へ枝を伸ばす。
const NOTES: readonly (readonly [number, number])[] = [
  [192, 104], [108, 151], [276, 157], [185, 224],
  [47, 113], [61, 221], [126, 281], [231, 280],
  [334, 106], [338, 225], [286, 307], [180, 356],
  [43, 318], [93, 369], [63, 423], [234, 415],
  [332, 360], [347, 422], [148, 414], [141, 77],
  [250, 81], [26, 268], [224, 172], [299, 409],
  [132, 196], [248, 353], [24, 386], [359, 291],
  [299, 65], [24, 177], [361, 168], [161, 310],
  [278, 234], [166, 159], [103, 331], [218, 324],
  [79, 273], [306, 183],
];

export function graphNodeState(node: GraphNode): GraphState {
  if (node.age >= node.fadeAt) return 'fading';
  return node.age <= node.warning ? 'warning' : 'active';
}

export function graphEdgeState(edge: GraphEdge): GraphState {
  const from = graphNodeState(edge.from); const to = graphNodeState(edge.to);
  if (from === 'fading' || to === 'fading') return 'fading';
  return from === 'active' && to === 'active' ? 'active' : 'warning';
}

export function graphEdgeDistance(edge: GraphEdge, x: number, y: number): number {
  const dx = edge.to.x - edge.from.x; const dy = edge.to.y - edge.from.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - edge.from.x) * dx + (y - edge.from.y) * dy) / length2));
  return Math.hypot(x - edge.from.x - dx * t, y - edge.from.y - dy * t);
}

function crosses(from: GraphNode, to: GraphNode, edge: GraphEdge): boolean {
  if (edge.from === from || edge.to === from) return false;
  const side = (a: GraphNode, b: GraphNode, c: GraphNode): number => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return side(from, to, edge.from) * side(from, to, edge.to) < 0
    && side(edge.from, edge.to, from) * side(edge.from, edge.to, to) < 0;
}

function canLink(node: GraphNode): boolean {
  return graphNodeState(node) !== 'fading' && node.x >= 32 && node.x <= FIELD.w - 32 && node.y >= 32 && node.y <= FIELD.h - 32;
}

export function emitObsidiaGraph(game: Game): void {
  if (game.bombFrames > 0) return;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const t = game.graphFrame++;
  const step = t % GRAPH_PERIOD;
  if (step === 0) { game.graphNodes.length = 0; game.graphEdges.length = 0; }
  const index = step / GRAPH_BEAT[level];
  if (!Number.isInteger(index) || index >= GRAPH_COUNT[level]) return;
  const wave = Math.floor(t / GRAPH_PERIOD);
  const [nx, ny] = NOTES[index];
  // 照準は生成時だけ。予告が見えた後は追尾せず、その場所から退けばよい。
  const aimed = index >= 7 && index % 4 === 3;
  const node: GraphNode = {
    x: aimed ? game.px : wave % 2 ? FIELD.w - nx : nx,
    y: aimed ? game.py : ny,
    radius: index === 0 ? 7 : 5, age: 0, warning: GRAPH_WARNING[level],
    fadeAt: GRAPH_PERIOD - GRAPH_FADE - step, color: index % 3,
    label: index === 0 ? '書庫' : index === 6 ? '記録' : index === 10 ? '着想' : '',
    grazed: false, announced: false,
  };
  // 同じ場所へ育て直して予告を延長し続ける安置を作らない。
  if (game.graphNodes.some(old => graphNodeState(old) !== 'fading' && Math.hypot(old.x - node.x, old.y - node.y) <= old.radius + 2.5)) return;
  // 新しい丸が古い危険物同士を橋渡ししないよう、周囲の枝を先にほどく。
  for (const old of game.graphNodes) {
    if (Math.hypot(old.x - node.x, old.y - node.y) - old.radius - node.radius <= 6) old.fadeAt = Math.min(old.fadeAt, old.age);
  }
  for (const edge of game.graphEdges) {
    if (graphEdgeState(edge) === 'fading' || graphEdgeDistance(edge, node.x, node.y) - node.radius - GRAPH_LINE_WIDTH / 2 > 6) continue;
    const old = Math.hypot(edge.from.x - node.x, edge.from.y - node.y) < Math.hypot(edge.to.x - node.x, edge.to.y - node.y) ? edge.from : edge.to;
    old.fadeAt = Math.min(old.fadeAt, old.age);
  }
  // 壁際は孤立ノートにする。内側では交差と閉路を作らず、残った親へ接続する。
  const parents = canLink(node) ? game.graphNodes.filter(canLink).sort((a, b) => Math.hypot(a.x - node.x, a.y - node.y) - Math.hypot(b.x - node.x, b.y - node.y)) : [];
  const parent = parents.find(candidate => {
    if (game.graphEdges.some(edge => graphEdgeState(edge) !== 'fading' && crosses(candidate, node, edge))) return false;
    const line: GraphEdge = { from: candidate, to: node, grazed: false };
    return !game.graphNodes.some(other => other !== candidate && graphNodeState(other) !== 'fading' && graphEdgeDistance(line, other.x, other.y) - other.radius - GRAPH_LINE_WIDTH / 2 <= 6);
  });
  if (parent) game.graphEdges.push({ from: parent, to: node, grazed: false });
  game.graphNodes.push(node);
}

export function updateObsidiaGraph(game: Game): void {
  let sounded = false;
  for (let i = game.graphNodes.length - 1; i >= 0; i--) {
    const node = game.graphNodes[i]; node.age++;
    if (node.age >= node.fadeAt + GRAPH_FADE) { game.graphNodes.splice(i, 1); continue; }
    if (graphNodeState(node) === 'active' && !node.announced) {
      node.announced = true;
      if (!sounded) { game.triggerBossCast(); game.audio.play('enemyShot'); sounded = true; }
    }
  }
  const alive = new Set(game.graphNodes);
  for (let i = game.graphEdges.length - 1; i >= 0; i--) {
    const edge = game.graphEdges[i];
    if (!alive.has(edge.from) || !alive.has(edge.to)) game.graphEdges.splice(i, 1);
  }
  if (game.invulnFrames > 0 || game.invincible || game.pendingHit >= 0) return;
  const contact = (distance: number, hazard: { grazed: boolean }): void => {
    if (distance <= 2.5) { game.pendingHit = 0; game.hitDuringSpell = true; }
    else if (!hazard.grazed && distance <= 18) { hazard.grazed = true; game.grazeAt(game.px, game.py); }
  };
  for (const node of game.graphNodes) {
    if (graphNodeState(node) !== 'active') continue;
    contact(Math.hypot(game.px - node.x, game.py - node.y) - node.radius, node);
    if (game.pendingHit >= 0) return;
  }
  for (const edge of game.graphEdges) {
    if (graphEdgeState(edge) !== 'active') continue;
    contact(graphEdgeDistance(edge, game.px, game.py) - GRAPH_LINE_WIDTH / 2, edge);
    if (game.pendingHit >= 0) return;
  }
}
