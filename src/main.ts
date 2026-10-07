import './style.css';
import { Game } from './game';
import { Renderer } from './render';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d', { alpha: false })!;
const game = new Game();
const renderer = new Renderer(ctx);
let currentDpr = window.devicePixelRatio;

function resize(): void {
  currentDpr = window.devicePixelRatio;
  const scale = Math.min(window.innerWidth / 640, window.innerHeight / 480);
  const width = 640 * scale;
  const height = 480 * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const pixelRatio = scale * window.devicePixelRatio;
  const pixelWidth = Math.max(1, Math.round(640 * pixelRatio));
  const pixelHeight = Math.max(1, Math.round(480 * pixelRatio));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    renderer.setPixelRatio(Math.min(pixelWidth / 640, pixelHeight / 480));
  }
  ctx.setTransform(pixelWidth / 640, 0, 0, pixelHeight / 480, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
let accumulator = 0;
let frames = 0;
let fpsStart = last;
const step = 1000 / 60;
function loop(now: number): void {
  if (window.devicePixelRatio !== currentDpr) resize();
  accumulator += Math.min(250, now - last);
  last = now;
  let updates = 0;
  while (accumulator >= step && updates < 4) {
    game.update();
    accumulator -= step;
    updates++;
  }
  if (updates === 4) accumulator = Math.min(accumulator, step);
  renderer.draw(game);
  frames++;
  if (now - fpsStart >= 1000) { game.fps = frames * 1000 / (now - fpsStart); frames = 0; fpsStart = now; }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

declare global {
  interface Window { __owlery?: { state: () => Record<string, string | number | null>; skipPhase: () => void }; }
}
if (import.meta.env.DEV) {
  window.__owlery = { state: () => game.debugState, skipPhase: () => game.skipPhase() };
}
