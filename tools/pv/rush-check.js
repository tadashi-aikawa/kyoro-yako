export async function verifyRush(pv) {
  const b = pv.board, cuts = b.cuts.filter(c => c.kind === 'gameplay-columns');
  const trio = b.cuts.find(c => c.kind === 'cutin-trio'), fps = b.fps, results = [];
  const check = (ok, message) => { if (!ok) throw new Error(`道中3列: ${message}`); };
  const at = time => pv.renderFrame(Math.round(time * fps));
  for (const [i, cut] of cuts.entries()) {
    const state = await at(cut.start + 0.5), columns = state.visual.rush.columns;
    check(columns.length === i + 1, `${cut.id}の列数`);
    for (const [j, column] of columns.entries()) {
      check(column.x === j * 640 && column.width === 640 && Math.abs(column.height - 640 * 446 / 382) < 0.001
        && column.enter === 1, `${column.id}の位置・サイズ`);
      check(column.frame === state.frame - Math.round(cuts[j].start * fps), `${column.id}の撮影が継続していません`);
    }
    const moving = (await at(cut.start + 0.1)).visual.rush.columns.at(-1);
    check(i === 0 ? moving.dx < 0 : i === 1 ? moving.dy > 0 : moving.dx > 0, `${cut.id}の登場方向`);
    results.push({ id: cut.id, capture: cut.capture, columns });
  }
  const first = Math.round(trio.start * fps);
  const before = await pv.renderFrame(first - 1), on = await pv.renderFrame(first);
  check(on.visual.rush.columns.every((c, i) => c.frame === before.visual.rush.columns[i].frame + 1), 'カットイン頭で撮影がリセットされています');
  const dimmed = await at(trio.start + 0.25);
  check(Math.abs(dimmed.visual.rush.brightness - (b.presentation.rush.trioBackdrop ? 0.3 : 0)) < 0.001, '下地の明るさ');
  const ctx = document.querySelector('#pv').getContext('2d');
  const region = () => ctx.getImageData(0, 720, 1920, 360).data;
  const a = region().slice();
  await at(trio.start + 0.4);
  const c = region();
  check(b.presentation.rush.trioBackdrop ? a.some((n, i) => n !== c[i]) : a.every((n, i) => n === c[i]), '未登場の段の下地が動いていません／黒背景比較が変化しています');
  const end = Math.round(b.cuts[b.cuts.indexOf(trio) + 1].start * fps) - 1;
  const final = await pv.renderFrame(end);
  for (const shot of final.captures.filter(s => s.id.startsWith('rush-'))) {
    check(shot.stats.visibleHitFrames === 0 && shot.stats.overlapFrames === 0, `${shot.id}の被弾・接触候補`);
  }
  const seek = pv.snapshot();
  await pv.renderFrame(end - 3);
  for (let frame = end - 2; frame <= end; frame++) await pv.renderFrame(frame);
  check(pv.snapshot() === seek, 'seekと連続描画の不一致');
  results.push({ trioBackdrop: b.presentation.rush.trioBackdrop, brightness: dimmed.visual.rush.brightness,
    blur: dimmed.visual.rush.blur, continuous: true, moving: true, deterministic: true,
    captures: final.captures.filter(s => s.id.startsWith('rush-')) });
  return results;
}
