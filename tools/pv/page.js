import initialBoard from './storyboard.json';
import { Capture } from './capture.js';
import { Composition, layouts, fieldRect } from './composition.js';

let board = initialBoard, composition, capture, last = -1;
const states = new Map();
const canvas = document.querySelector('#pv');

function incomingFrames(index) {
  if (index === 0) return 0;
  const cut = board.cuts[index], previous = board.cuts[index - 1];
  if (cut.transition === 'none' || cut.transition === 'flash' || previous.kind === 'gameplay' || previous.kind === 'cutin-trio') return 0;
  return Math.round((cut.crossfade ?? board.effects.crossfade) * board.fps);
}

function validate(b) {
  if (b.width !== 1920 || b.height !== 1080 || b.fps !== 60) throw new Error('PVは1920×1080 / 60fps固定です');
  if (!Number.isFinite(b.duration) || b.duration <= 0) throw new Error('durationが不正です');
  for (const [key, value] of Object.entries(b.effects ?? {})) if (!Number.isFinite(value) || value < 0) throw new Error(`effects.${key}が不正です`);
  for (const key of ['portraitSlide', 'nameDuration', 'quoteDuration', 'storyFade', 'trioSlide', 'titleFade', 'genreFade']) if (!(b.effects?.[key] > 0)) throw new Error(`effects.${key}には正の秒数を指定してください`);
  if (!(b.presentation?.fieldHeight > 0 && b.presentation.fieldHeight <= 1032 && b.presentation.fieldMargin >= 8 && b.presentation.portraitHeight > 0 && b.presentation.portraitHeight <= 1000)) throw new Error('presentationのフィールド・立ち絵サイズが不正です');
  if (b.cuts[0]?.start !== 0) throw new Error('先頭カットは0秒にしてください');
  const ids = new Set();
  for (let i = 0; i < b.cuts.length; i++) {
    const cut = b.cuts[i], end = b.cuts[i + 1]?.start ?? b.duration;
    if (!/^[a-z0-9-]+$/.test(cut.id) || ids.has(cut.id)) throw new Error(`idが不正・重複: ${cut.id}`);
    ids.add(cut.id);
    if (!Number.isFinite(cut.start) || end <= cut.start || cut.start < 0 || end > b.duration) throw new Error(`カット時刻の順序が不正: ${cut.id}`);
    if (cut.review < 0 || cut.review >= end - cut.start) throw new Error(`reviewはカット内の秒数にしてください: ${cut.id}`);
    if (cut.capture && !layouts.includes(cut.layout)) throw new Error(`未定義レイアウト: ${cut.layout}`);
  }
}

async function configure(next = board) {
  validate(next); board = structuredClone(next);
  canvas.width = board.width; canvas.height = board.height;
  composition = new Composition(canvas, board);
  await composition.prepare();
  capture = undefined; states.clear(); last = -1;
}

async function renderCut(index, frame) {
  const cut = board.cuts[index];
  const first = Math.round(cut.start * board.fps) - incomingFrames(index);
  const end = Math.round((board.cuts[index + 1]?.start ?? board.duration) * board.fps);
  const local = frame - first;
  let state = states.get(index);
  if (!state) {
    const layer = document.createElement('canvas'); layer.width = board.width; layer.height = board.height;
    const renderer = new Composition(layer, board); renderer.images = composition.images;
    renderer.portraitCrops = composition.portraitCrops;
    const shot = cut.capture ? new Capture(board.pixelRatio) : undefined;
    if (shot) await shot.begin(cut);
    state = { canvas: layer, composition: renderer, capture: shot };
    states.set(index, state);
  }
  if (state.capture) {
    while (state.capture.frame < local) {
      state.capture.step();
      // 飛び先でも逐次書き出しと同じ姿勢履歴にする。
      if (state.capture.frame < local) state.capture.drawTo(state.composition.ctx, 0);
    }
  }
  await state.composition.draw(cut, local, end - first, state.capture, frame / board.fps);
  return { ...state, cut, local };
}

async function renderFrame(frame) {
  if (!Number.isInteger(frame) || frame < 0 || frame >= Math.round(board.duration * board.fps)) throw new Error(`frameが範囲外: ${frame}`);
  if (frame <= last) states.clear();
  const index = board.cuts.findLastIndex(cut => Math.round(cut.start * board.fps) <= frame);
  for (const key of states.keys()) if (key < index || key > index + 1) states.delete(key);
  const current = await renderCut(index, frame);
  capture = current.capture;
  const c = composition.ctx; c.reset(); c.drawImage(current.canvas, 0, 0);
  composition.textBounds = current.composition.textBounds;
  const captures = current.capture ? [{ id: current.cut.id, stats: current.capture.stats }] : [];
  let transition = null;
  if (index + 1 < board.cuts.length) {
    const next = board.cuts[index + 1], boundary = Math.round(next.start * board.fps), duration = incomingFrames(index + 1);
    if (duration > 0 && frame >= boundary - duration) {
      const incoming = await renderCut(index + 1, frame);
      const alpha = (frame - (boundary - duration)) / duration;
      const fieldOnly = next.kind === 'character' && next.presentationStart === current.cut.start;
      c.save();
      if (fieldOnly) {
        const field = fieldRect(next, board);
        c.beginPath(); c.rect(field.x, field.y, field.width, field.height); c.clip();
      }
      c.globalAlpha = alpha; c.drawImage(incoming.canvas, 0, 0); c.restore();
      if (incoming.capture) captures.push({ id: next.id, stats: incoming.capture.stats });
      transition = { to: next.id, alpha, fieldOnly, boundary };
    }
  }
  last = frame;
  return { cut: current.cut.id, frame, local: current.local, stats: capture?.stats, captures, transition, textBounds: composition.textBounds, visual: current.composition.visual };
}

function base64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(s);
}

async function preflight() {
  const results = [];
  for (let i = 0; i < board.cuts.length; i++) {
    const cut = board.cuts[i];
    if (!cut.capture) continue;
    const frames = Math.round((board.cuts[i + 1]?.start ?? board.duration) * board.fps) - Math.round(cut.start * board.fps) + incomingFrames(i);
    const candidate = new Capture(board.pixelRatio);
    await candidate.begin(cut);
    let available = 0, exhausted = false;
    const limit = frames + (cut.capture.defeatAt === undefined ? 300 : 0);
    for (; available < limit; available++) {
      try {
        candidate.step();
        candidate.drawTo(composition.ctx, 0);
      } catch (error) {
        if (available < frames) throw new Error(`事前検査 ${cut.id}: 必要${frames}f / 撮影可能${available}f。${error.message}`);
        exhausted = true;
        break;
      }
    }
    results.push({ id: cut.id, frames, availableFrames: available, marginFrames: available - frames, limitReached: exhausted });
  }
  states.clear(); last = -1; capture = undefined;
  return results;
}

async function encode(from = 0, to = Math.round(board.duration * board.fps)) {
  const config = {
    codec: 'avc1.64002a', width: board.width, height: board.height,
    framerate: board.fps, bitrate: board.bitrate, latencyMode: 'realtime',
    hardwareAcceleration: 'prefer-software', avc: { format: 'annexb' },
  };
  if (!(await VideoEncoder.isConfigSupported(config)).supported) throw new Error('ChromeでH.264 WebCodecsが利用できません');
  let chunks = [], error, count = 0;
  const encoder = new VideoEncoder({
    output(chunk) { const bytes = new Uint8Array(chunk.byteLength); chunk.copyTo(bytes); chunks.push(bytes); count++; },
    error(e) { error = e; },
  });
  encoder.configure(config);
  const stats = new Map();
  const auditFrames = new Set(board.cuts.flatMap((cut, index) => [
    ...Array.from({ length: 12 }, (_, i) => Math.round(cut.start * board.fps) - incomingFrames(index) + i),
    ...Array.from({ length: 12 }, (_, i) => Math.round(cut.start * board.fps) + i),
    Math.round((cut.start + cut.review) * board.fps),
  ]));
  const rgbaSha256 = [];
  try {
    for (let frame = from; frame < to; frame++) {
      const result = await renderFrame(frame);
      for (const shot of result.captures) stats.set(shot.id, structuredClone(shot.stats));
      // Canvas由来のVideoFrameは描画内容によって色レンジが変わるため、RGBAへ固定する。
      const pixels = canvas.getContext('2d').getImageData(0, 0, board.width, board.height);
      if (auditFrames.has(frame)) {
        const digest = await crypto.subtle.digest('SHA-256', pixels.data);
        rgbaSha256.push({ frame, hash: [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('') });
      }
      const video = new VideoFrame(pixels.data, {
        format: 'RGBA', codedWidth: board.width, codedHeight: board.height,
        colorSpace: { primaries: 'bt709', transfer: 'iec61966-2-1', matrix: 'rgb', fullRange: true },
        timestamp: Math.round((frame - from) * 1e6 / board.fps), duration: Math.round(1e6 / board.fps),
      });
      encoder.encode(video, { keyFrame: (frame - from) % 120 === 0 }); video.close();
      if (error) throw error;
      if ((frame - from + 1) % 60 === 0 || frame === to - 1) {
        await encoder.flush();
        if (error) throw error;
        const size = chunks.reduce((n, bytes) => n + bytes.length, 0);
        const joined = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
        chunks = [];
        await window.pvWriteChunk(base64(joined), frame + 1, result.cut);
      }
    }
    if (count !== to - from) throw new Error(`出力フレーム数が不一致: ${count}`);
    return { frames: count, stats: [...stats.values()], encoder: config, rgbaSha256 };
  } finally { encoder.close(); }
}

window.pv = {
  configure, renderFrame, encode, preflight, incomingFrames,
  snapshot: () => canvas.toDataURL('image/webp', 0.94),
  get board() { return board; },
  get state() { return capture ? { px: capture.game.px, py: capture.game.py, phaseFrame: capture.game.phaseFrame, phaseHp: capture.game.phaseHp, cutin: capture.game.cutin, scene: capture.game.scene, bullets: capture.game.bullets.count, ...capture.stats } : null; },
};
await configure();
await renderFrame(Number(new URLSearchParams(location.search).get('frame') ?? 0));
window.pv.ready = true;
