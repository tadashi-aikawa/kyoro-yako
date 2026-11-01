import initialBoard from './storyboard.json';
import { Capture } from './capture.js';
import { Composition, layouts } from './composition.js';

let board = initialBoard, composition, capture, active = -1, last = -1;
const canvas = document.querySelector('#pv');

function validate(b) {
  if (b.width !== 1920 || b.height !== 1080 || b.fps !== 60) throw new Error('PVは1920×1080 / 60fps固定です');
  if (!Number.isFinite(b.duration) || b.duration <= 0) throw new Error('durationが不正です');
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
  capture = undefined; active = -1; last = -1;
}

async function renderFrame(frame) {
  if (!Number.isInteger(frame) || frame < 0 || frame >= Math.round(board.duration * board.fps)) throw new Error(`frameが範囲外: ${frame}`);
  const index = board.cuts.findLastIndex(cut => Math.round(cut.start * board.fps) <= frame);
  const cut = board.cuts[index];
  const first = Math.round(cut.start * board.fps);
  const end = Math.round((board.cuts[index + 1]?.start ?? board.duration) * board.fps);
  const local = frame - first;
  if (active !== index || frame <= last) {
    capture = cut.capture ? new Capture(board.pixelRatio) : undefined;
    if (capture) await capture.begin(cut);
    active = index;
  }
  if (capture) {
    while (capture.frame < local) {
      capture.step();
      // 飛び先でも逐次書き出しと同じ姿勢履歴にする。
      if (capture.frame < local) capture.drawTo(composition.ctx, 0);
    }
  }
  await composition.draw(cut, local, end - first, capture);
  last = frame;
  return { cut: cut.id, frame, local, stats: capture?.stats, textBounds: composition.textBounds };
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
    const frames = Math.round((board.cuts[i + 1]?.start ?? board.duration) * board.fps) - Math.round(cut.start * board.fps);
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
  active = -1; last = -1; capture = undefined;
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
  const auditFrames = new Set(board.cuts.flatMap(cut => [
    ...Array.from({ length: 12 }, (_, i) => Math.round(cut.start * board.fps) + i),
    Math.round((cut.start + cut.review) * board.fps),
  ]));
  const rgbaSha256 = [];
  try {
    for (let frame = from; frame < to; frame++) {
      const result = await renderFrame(frame);
      if (result.stats) stats.set(result.cut, structuredClone(result.stats));
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
  configure, renderFrame, encode, preflight,
  snapshot: () => canvas.toDataURL('image/webp', 0.94),
  get board() { return board; },
  get state() { return capture ? { px: capture.game.px, py: capture.game.py, phaseFrame: capture.game.phaseFrame, phaseHp: capture.game.phaseHp, cutin: capture.game.cutin, scene: capture.game.scene, bullets: capture.game.bullets.count, ...capture.stats } : null; },
};
await configure();
await renderFrame(Number(new URLSearchParams(location.search).get('frame') ?? 0));
window.pv.ready = true;
