import { Composition, fieldRect } from './composition.js';

export async function verifyPresentation(pv) {
  const board = pv.board, fps = board.fps, fx = board.effects, results = [];
  const ctx = document.querySelector('#pv').getContext('2d');
  const at = (cut, seconds) => pv.renderFrame(Math.round(cut.start * fps) - pv.incomingFrames(board.cuts.indexOf(cut)) + Math.round(seconds * fps));
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const testCanvas = document.createElement('canvas'); testCanvas.width = 1920; testCanvas.height = 1080;
  const test = new Composition(testCanvas, board), field = fieldRect(null, board);
  test.drawField({ drawTo(c) { c.fillStyle = '#fff'; c.fillRect(0, 0, 1920, 1080); } }, field);
  const alpha = x => test.fieldCanvas.getContext('2d').getImageData(Math.floor(x), 540, 1, 1).data[3];
  const mask = [0, field.width - 51, field.width - 25, field.width - 1].map(alpha);
  check(mask[0] === 255 && mask[1] === 255 && mask[2] > 115 && mask[2] < 140 && mask[3] < 10, `右端の50pxフェザーが不正: ${mask}`);
  results.push({ fieldMaskAlpha: mask });

  for (const cut of board.cuts.filter(c => c.kind === 'story')) {
    const settled = await at(cut, 2.5);
    check([...ctx.getImageData(100, 100, 1, 1).data].join(',') === '0,0,0,255', `${cut.id}: 背景が黒ではありません`);
    check(settled.visual.portrait.x < 960 && settled.textBounds.every(t => t.x >= 960), `${cut.id}: 左のみみこと右のセリフ配置が不正`);
    const first = await at(cut, 0.5), second = await at(cut, 1.5);
    check(first.visual.storyLines[0].alpha === 0.5 && first.visual.storyLines[1].alpha === 0 && first.textBounds[0].text === cut.text[0], `${cut.id}: 1行目のフェードが不正`);
    check(second.visual.storyLines[0].alpha === 1 && second.visual.storyLines[1].alpha === 0.5 && second.textBounds[1].text === cut.text[1], `${cut.id}: 行ごとのフェードが不正`);
    check(first.visual.storyLines[0].y - settled.visual.storyLines[0].y === 5 && second.visual.storyLines[1].y - settled.visual.storyLines[1].y === 5, `${cut.id}: 10pxの浮上が不正`);
    results.push({ id: cut.id, lineFade: true, fullLinesWithoutTyping: true });
  }

  for (const cut of board.cuts.filter(c => c.kind === 'character')) {
    const settled = await pv.renderFrame(Math.round((cut.start + cut.review) * fps));
    const f = settled.visual.field, p = settled.visual.portrait;
    check(f.x === 0 && f.y === 0 && f.height === 1080 && f.padding === -1 && f.feather === 50, `${cut.id}: 縦いっぱい・左寄せ・枠除去・フェザーが不一致`);
    const sizeMatches = cut.portraitWidth === undefined ? Math.abs(p.height - 800) < 0.01 : Math.abs(p.width - 500) < 0.01;
    check(sizeMatches && Math.abs(p.y + p.height / 2 - 540) < 0.01 && p.x > f.width && p.x + p.width < 1920, `${cut.id}: 立ち絵の大きさ・位置が不一致`);
    const names = settled.textBounds.filter(t => t.role === 'name'), quotes = settled.textBounds.filter(t => t.role === 'quote');
    check(names.length === 1 && names[0].text === cut.name && quotes.length === 1 && quotes[0].text === cut.quote, `${cut.id}: 名前の横書き・セリフの全表示が不正`);
    check(names[0].x > f.width && names[0].y > 700 && quotes[0].y > names[0].bottom, `${cut.id}: 統一した名前・セリフの配置が不正`);
    check(!settled.visual.background, `${cut.id}: 既定の背景が黒ではありません`);
    if (cut.presentationStart !== undefined) { results.push({ id: cut.id, unifiedLayout: true }); continue; }
    const nameAt = fx.portraitSlide + fx.nameDelay, quoteAt = nameAt + fx.nameDuration + fx.quoteDelay;
    const pose = await at(cut, fx.portraitSlide - 1 / fps), start = await at(cut, nameAt);
    const stamp = await at(cut, nameAt + 0.05), landed = await at(cut, nameAt + 0.25);
    check(!pose.textBounds.length && start.visual.motion.nameScale === 1.6 && !start.textBounds.length, `${cut.id}: 立ち絵停止前に文字が出ています`);
    check(stamp.visual.motion.nameScale > 1 && stamp.textBounds[0].alpha < 1 && !stamp.textBounds.some(t => t.role === 'quote'), `${cut.id}: 名前の縮小・フェードが不正`);
    check(landed.visual.motion.nameScale === 1 && landed.visual.motion.impact > 0, `${cut.id}: 名前の着地が不正`);
    const typed = [];
    for (const seconds of [0.1, 0.2, 0.3]) {
      const state = await at(cut, quoteAt + seconds), quote = state.textBounds.find(t => t.role === 'quote');
      const count = Math.floor(seconds / 0.03 + 1e-8);
      check(quote?.text === [...cut.quote].slice(0, count).join('') && quote.alpha === 1, `${cut.id}: 30msのタイプライターが不正`);
      check(Math.abs(quote.x - quotes[0].x) < 0.01 && quote.size === quotes[0].size, `${cut.id}: タイプ途中で既出文字の位置・サイズが変化`);
      typed.push(quote.text);
    }
    results.push({ id: cut.id, field: f, portrait: p, unifiedLayout: true, stamp: true, typed });
  }
  return results;
}
