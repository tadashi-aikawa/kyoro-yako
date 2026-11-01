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
  const rightField = fieldRect({ portraitSide: 'left' }, board);
  test.drawField({ drawTo(c) { c.fillStyle = '#fff'; c.fillRect(0, 0, 1920, 1080); } }, rightField);
  const reversed = [0, 25, 51, rightField.width - 1].map(alpha);
  check(reversed[0] < 10 && reversed[1] > 115 && reversed[1] < 140 && reversed[2] === 255 && reversed[3] === 255, `左端のフェザーが不正: ${reversed}`);
  results.push({ leftFieldMaskAlpha: reversed });

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

  const characterStages = { gate: 1, neo: 1, etokichi: 5, obsidia: 2, chappy: 3, claudine: 3, jinrai: 4, minerva: 5 };
  const leftCharacters = new Set(['neo', 'obsidia', 'claudine', 'minerva']);
  for (const cut of board.cuts.filter(c => c.kind === 'character')) {
    const settled = await pv.renderFrame(Math.round((cut.start + cut.review) * fps));
    const f = settled.visual.field, p = settled.visual.portrait;
    const left = leftCharacters.has(cut.id.replace(/-ult$/, '')), panel = settled.visual.panel;
    check(panel.side === (left ? 'left' : 'right'), `${cut.id}: 左右交互の配置が不一致`);
    check(f.x === (left ? 1920 - f.width : 0) && f.y === 0 && f.height === 1080 && f.padding === -1 && f.feather === 50, `${cut.id}: 縦いっぱい・外側寄せ・枠除去・フェザーが不一致`);
    const sizeMatches = cut.portraitWidth === undefined ? Math.abs(p.height - 800) < 0.01 : Math.abs(p.width - 500) < 0.01;
    check(sizeMatches && Math.abs(p.y + p.height / 2 - 540) < 0.01 && p.x > panel.x && p.x + p.width < panel.x + panel.width, `${cut.id}: 立ち絵の大きさ・位置が不一致`);
    const names = settled.textBounds.filter(t => t.role === 'name'), quotes = settled.textBounds.filter(t => t.role === 'quote');
    check(names.length === 1 && names[0].text === cut.name && quotes.length === 1 && quotes[0].text === cut.quote, `${cut.id}: 名前の横書き・セリフの全表示が不正`);
    check(names[0].x > panel.x && names[0].right < panel.x + panel.width && names[0].y > 700 && quotes[0].y > names[0].bottom, `${cut.id}: 統一した名前・セリフの配置が不正`);
    const background = settled.visual.background, configured = board.presentation.characterBackground;
    if (configured.enabled) {
      check(background?.stage === characterStages[cut.id.replace(/-ult$/, '')], `${cut.id}: 背景の階が不一致`);
      check(['opacity', 'brightness', 'blur'].every(key => background[key] === configured[key]), `${cut.id}: 背景の濃さ・明るさ・ぼかしが不一致`);
    } else check(!background, `${cut.id}: 無効化した背景が表示されています`);
    results.push({ id: cut.id, background: background ?? null });
    if (cut.presentationStart !== undefined) { results.push({ id: cut.id, unifiedLayout: true }); continue; }
    const nameAt = fx.portraitSlide + fx.nameDelay, quoteAt = nameAt + fx.nameDuration + fx.quoteDelay;
    const pose = await at(cut, fx.portraitSlide - 1 / fps), start = await at(cut, nameAt);
    // クロスフェード中のrenderFrameは前カットのvisualを返すため、カット確定後・停止直前を測る。
    const entering = await at(cut, fx.portraitSlide - 2 / fps);
    check(left ? entering.visual.portrait.x < p.x : entering.visual.portrait.x > p.x, `${cut.id}: 外側からのスライドではありません`);
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
  const announcement = board.cuts.find(c => c.kind === 'announcement');
  const announced = await at(announcement, 1.5);
  check(announced.textBounds.some(t => t.text === board.author && t.size < 48 && t.alpha === 1)
    && !announced.textBounds.some(t => /https?:|github\.io/.test(t.text)), '告知の作者名・URL除去が不正');
  results.push({ announcement: true, author: board.author, fullyVisibleBy: 1.5 });
  return results;
}
