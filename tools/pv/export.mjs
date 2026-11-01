import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, open, access, unlink, rename, mkdtemp, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { audioPlan, validateAudioSource, audioAlignmentWarnings } from './audio.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.join(root, '_Unversioned/pv');
const args = process.argv.slice(2);
const value = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const boardPath = path.resolve(value('--board', path.join(here, 'storyboard.json')));
const board = JSON.parse(await readFile(boardPath, 'utf8'));
const port = Number(value('--port', '5391'));
const url = `http://127.0.0.1:${port}`;
const reviewOnly = args.includes('--review-only');
const verify = args.includes('--verify');
const preflightOnly = args.includes('--preflight-only');
const sourceRef = value('--source-ref', null);
if (args.includes('--source-ref') && (!sourceRef || sourceRef.startsWith('-'))) throw new Error('--source-refにコミットを指定してください');
const from = Math.round(Number(value('--from', '0')) * board.fps);
const to = Math.round(Number(value('--to', String(board.duration))) * board.fps);
const partial = from !== 0 || to !== Math.round(board.duration * board.fps);
const filename = value('--name', partial ? `preview-${from}-${to}` : 'kyoro-yako-pv');
if (!/^[a-z0-9-]+$/.test(filename)) throw new Error('--nameは半角英小文字・数字・ハイフンで指定してください');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('--portが不正です');
if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from || to > Math.round(board.duration * board.fps)) throw new Error('--from / --toが動画の範囲外です');
const videoPath = path.join(out, `${filename}.mp4`);
const reviewDir = path.join(out, 'review', args.includes('--name') || partial ? filename : '');
const audio = audioPlan(board.music, { duration: board.duration, from: from / board.fps, to: to / board.fps, partial });
const started = performance.now();

function run(command, argv, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let stdout = '', stderr = '';
    child.stdout?.on('data', b => { stdout += b; });
    child.stderr?.on('data', b => { stderr += b; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(`${command}: ${code}\n${stderr.slice(-6000)}`)));
  });
}
const exists = async file => access(file).then(() => true, () => false);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pinnedCommit = sourceRef ? (await run('git', ['rev-parse', '--verify', `${sourceRef}^{commit}`])).trim() : null;

async function sourceVersion() {
  if (pinnedCommit) return {
    head: pinnedCommit,
    srcCommit: (await run('git', ['log', '-1', '--format=%H', pinnedCommit, '--', 'src'])).trim(),
    dirty: false, diffSha256: sha(''), pinned: true,
  };
  return {
    head: (await run('git', ['rev-parse', 'HEAD'])).trim(),
    srcCommit: (await run('git', ['log', '-1', '--format=%H', '--', 'src'])).trim(),
    dirty: !!(await run('git', ['status', '--porcelain', '--', 'src'])).trim(),
    diffSha256: sha(await run('git', ['diff', 'HEAD', '--', 'src'])),
  };
}

async function cleanOld() {
  for (const name of await readdir(out)) {
    if (path.join(out, name) === boardPath) continue;
    if (/^(preview-|acceptance-|color-test|announcement\.|fix1-preview\.)/.test(name) && !name.startsWith(`${filename}.`)) {
      await rm(path.join(out, name), { recursive: true, force: true });
      continue;
    }
    if (name.endsWith('.h264') && !args.includes('--keep-intermediate')) await unlink(path.join(out, name));
  }
  for (const name of await readdir(path.join(out, 'review'))) {
    if (/^(characters\.|chorus\.|structure\.|edit-|issen-sequence|source-|preview-|acceptance-|source$|announcement$|fix1-preview$)/.test(name) && name !== filename) await rm(path.join(out, 'review', name), { recursive: true, force: true });
  }
  if (!partial && filename === 'kyoro-yako-pv') {
    for (const id of ['genre', 'conversation', 'issen-cutin', 'issen', 'bloom-cutin', 'bloom', 'owl-cutin', 'owl', 'gold', 'defeat']) {
      await rm(path.join(out, 'review', `${id}.webp`), { force: true });
    }
  }
}

async function contactSheet(directory, ids, name = 'contact', columns = 3, cell = { width: 640, height: 360 }) {
  if (!ids.length) return;
  const list = path.join(directory, `${name}.txt`);
  await writeFile(list, ids.map(id => `file '${id}.webp'`).join('\n'));
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', `scale=${cell.width}:${cell.height},tile=${columns}x${Math.ceil(ids.length / columns)}:color=0x080817`, '-frames:v', '1', path.join(directory, `${name}.png`)]);
  await run('cwebp', ['-quiet', '-q', '90', path.join(directory, `${name}.png`), '-o', path.join(directory, `${name}.webp`)]);
  await unlink(list); await unlink(path.join(directory, `${name}.png`));
}

const warnings = audioAlignmentWarnings(audio, board.cuts);
for (const warning of warnings) console.warn(`警告: ${warning}`);
const music = path.join(root, board.music.path), hasMusic = await exists(music);
if (hasMusic) {
  const sourceDuration = Number(await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', music]));
  validateAudioSource(audio, sourceDuration);
}

await mkdir(path.join(out, 'review'), { recursive: true });
await mkdir(path.join(out, 'ending'), { recursive: true });
// 朝空だけを固定時刻でデコード。動画の再生時計・seek完了時刻に依存しない。
const ending = path.join(root, board.ending.path);
const signature = sha(await readFile(ending)) + JSON.stringify(board.ending) + board.fps;
const signaturePath = path.join(out, 'ending/signature.txt');
if (!await exists(signaturePath) || await readFile(signaturePath, 'utf8') !== signature) {
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(board.ending.offset), '-i', ending,
    '-an', '-t', String(board.ending.duration), '-vf', `fps=${board.fps},scale=1920:1080`,
    path.join(out, 'ending/%04d.png')]);
  for (let i = 1; i <= Math.round(board.ending.duration * board.fps); i += 4) {
    await Promise.all(Array.from({ length: Math.min(4, Math.round(board.ending.duration * board.fps) - i + 1) }, async (_, j) => {
      const file = path.join(out, `ending/${String(i + j).padStart(4, '0')}`);
      await run('cwebp', ['-quiet', '-q', '92', `${file}.png`, '-o', `${file}.webp`]);
      await unlink(`${file}.png`);
    }));
  }
  await writeFile(signaturePath, signature);
}

let server, browser, stream, staging;
const pageErrors = [];
try {
  staging = await mkdtemp(path.join(out, '.work-'));
  const source = await sourceVersion();
  let captureSource = '';
  if (pinnedCommit) {
    const archive = path.join(staging, 'source.tar'), directory = path.join(staging, 'source');
    await mkdir(directory);
    await run('git', ['archive', '--format=tar', `--output=${archive}`, pinnedCommit, 'src']);
    await run('tar', ['-xf', archive, '-C', directory]);
    await unlink(archive);
    captureSource = path.join(directory, 'src');
    console.log(`撮影本体を固定: ${pinnedCommit}`);
  }
  // 自分で起動した専用ポートだけを管理する。既存サーバーには接続しない。
  const occupied = await run('lsof', ['-ti', `tcp:${port}`]).then(s => s.trim(), () => '');
  if (occupied) throw new Error(`ポート${port}は使用中です。--portで空きポートを指定してください`);
  server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--config', path.join(here, 'vite.config.mjs'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env: { ...process.env, PV_CAPTURE_SOURCE: captureSource }, stdio: ['ignore', 'ignore', 'pipe'] });
  let serverLog = '';
  server.stderr.on('data', b => { serverLog += b; });
  server.on('error', e => { serverLog += e.message; });
  for (let i = 0; i < 100; i++) {
    if (await fetch(url).then(r => r.ok, () => false)) break;
    if (server.exitCode !== null || i === 99) throw new Error(`Viteを起動できません: ${serverLog}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  // Renderer内の補助CanvasもCPU描画へ統一する。
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-accelerated-2d-canvas'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  page.setDefaultTimeout(120000);
  page.on('crash', () => { pageErrors.push('Chromeのページがクラッシュしました'); console.error(pageErrors.at(-1)); });
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) console.log(`ページ遷移: ${frame.url()}`); });
  page.on('pageerror', e => { pageErrors.push(e.message); console.error(`ページエラー: ${e.message}`); });
  page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
  await page.goto(`${url}/tools/pv/index.html?bgm=0`);
  await page.waitForFunction(() => window.pv?.ready);
  await page.evaluate(b => window.pv.configure(b), board);
  const preflight = await page.evaluate(() => window.pv.preflight());
  console.log(`事前検査: ${JSON.stringify(preflight)}`);
  if (preflightOnly) {
    await writeFile(path.join(out, 'preflight.json'), JSON.stringify(preflight, null, 2));
  } else if (verify) {
    const results = [];
    for (const id of ['neo', 'rush-1', 'trio', 'claudine-ult', 'minerva-ult', 'announcement']) {
      const cut = board.cuts.find(c => c.id === id);
      const frame = Math.round((cut.start + cut.review) * board.fps);
      const snapshot = async f => {
        await page.evaluate(n => window.pv.renderFrame(n), f);
        return page.evaluate(() => ({ image: window.pv.snapshot(), state: window.pv.state }));
      };
      const a = await snapshot(frame);
      await snapshot(0);
      await snapshot(frame - 3);
      await snapshot(frame - 2);
      await snapshot(frame - 1);
      const b = await snapshot(frame);
      if (sha(a.image) !== sha(b.image) || JSON.stringify(a.state) !== JSON.stringify(b.state)) {
        await writeFile(path.join(out, `review/determinism-${id}-seek.webp`), Buffer.from(a.image.split(',')[1], 'base64'));
        await writeFile(path.join(out, `review/determinism-${id}-step.webp`), Buffer.from(b.image.split(',')[1], 'base64'));
        throw new Error(`${id}: 同じフレームを再現できません\n${JSON.stringify({ a: a.state, b: b.state, hashA: sha(a.image), hashB: sha(b.image) })}`);
      }
      results.push({ id, deterministic: true, hash: sha(a.image) });
    }
    const changed = structuredClone(board);
    const titleCut = changed.cuts.find(c => c.kind === 'announcement');
    titleCut.start += 0.5;
    changed.release = '2026年11月 公開予定　検証';
    await page.evaluate(b => window.pv.configure(b), changed);
    const selected = await page.evaluate(n => window.pv.renderFrame(n), Math.round((titleCut.start - 0.1) * board.fps));
    if (selected.cut === titleCut.id) throw new Error('カット時刻の変更が未反映');
    const text = await page.evaluate(n => window.pv.renderFrame(n), Math.round((titleCut.start + 2) * board.fps));
    if (!text.textBounds.some(t => t.text === changed.release)) throw new Error('文言の変更が未反映');
    results.push({ timingEditable: true, textEditable: true });
    for (const [id, duration] of [['chappy', 6]]) {
      const invalid = structuredClone(board);
      invalid.duration = duration;
      invalid.cuts = [{ ...invalid.cuts.find(c => c.id === id), start: 0 }];
      invalid.cuts[0].capture.holdHp = false;
      await page.evaluate(b => window.pv.configure(b), invalid);
      const error = await page.evaluate(async () => {
        try { await window.pv.preflight(); return ''; } catch (e) { return e.message; }
      });
      if (!error.includes(`事前検査 ${id}:`)) throw new Error(`${id}: 撮影時間超過を検出できません`);
      results.push({ id, overrunRejected: true, error });
    }
    await page.evaluate(b => window.pv.configure(b), board);
    const prayerCut = board.cuts.find(c => c.capture?.prayer);
    const prayerEnd = Math.round(board.cuts[board.cuts.indexOf(prayerCut) + 1].start * board.fps) - 1;
    const prayer = await page.evaluate(n => window.pv.renderFrame(n), prayerEnd);
    if (prayer.stats.prayerCycle !== 12 || prayer.stats.prayerChargeFrames !== 71 || prayer.stats.prayerFireFrames !== 180 || prayer.stats.visibleHitFrames !== 0) throw new Error('最後の祈りの撮影検査に失敗しました');
    results.push({ prayer: prayer.stats });
    const trio = board.cuts.find(c => c.kind === 'cutin-trio');
    const trioAudit = await page.evaluate(async cut => {
      const result = [];
      const ctx = document.querySelector('#pv').getContext('2d');
      for (const [index, member] of cut.members.entries()) {
        const first = Math.round(member.start * window.pv.board.fps);
        const before = await window.pv.renderFrame(first - 1);
        if (index > 0 && before.textBounds.length) throw new Error('3段カットインに文字が描かれています');
        const sample = () => Array.from(ctx.getImageData(960, index * 360 + 180, 1, 1).data).join(',');
        if (index > 0 && sample() !== '8,8,23,255') throw new Error('未登場の段がnight色ではありません');
        const settled = first + Math.ceil(window.pv.board.effects.trioSlide * window.pv.board.fps);
        const after = await window.pv.renderFrame(settled);
        if (after.textBounds.length || sample() === '8,8,23,255') throw new Error('差し込み後の絵が表示されていません');
        result.push({ start: member.start, settledFrame: settled });
      }
      return result;
    }, trio);
    results.push({ trio: trioAudit });
    const continuity = await page.evaluate(async () => {
      const ctx = document.querySelector('#pv').getContext('2d');
      const results = [];
      for (const cut of window.pv.board.cuts.filter(c => c.presentationStart !== undefined)) {
        const frame = Math.round(cut.start * window.pv.board.fps);
        const x = cut.layout === 'claudine' ? 0 : 926;
        await window.pv.renderFrame(frame - 1);
        const before = ctx.getImageData(x, 0, 994, 1080).data;
        await window.pv.renderFrame(frame);
        const after = ctx.getImageData(x, 0, 994, 1080).data;
        let delta = 0;
        for (let i = 0; i < before.length; i++) if (i % 4 !== 3) delta += Math.abs(before[i] - after[i]);
        const mean = delta / (994 * 1080 * 3);
        // 星の微小な明滅とフィールド境界のアンチエイリアスだけを許す。
        if (mean > 0.1) throw new Error(`${cut.id}: 技の切り替えで人物側の表示が変化しました: ${mean}`);
        results.push({ id: cut.id, portraitPanelMeanDelta: mean });
      }
      return results;
    });
    results.push({ continuity });
    const transitions = await page.evaluate(async () => {
      const result = [];
      for (let i = 1; i < window.pv.board.cuts.length; i++) {
        const cut = window.pv.board.cuts[i], boundary = Math.round(cut.start * window.pv.board.fps);
        const duration = window.pv.incomingFrames(i);
        const before = await window.pv.renderFrame(boundary - 1);
        const on = await window.pv.renderFrame(boundary);
        if (on.cut !== cut.id || on.transition) throw new Error(`${cut.id}: 小節頭で次のカットが確定していません`);
        if (duration > 0) {
          if (before.transition?.to !== cut.id || Math.abs(before.transition.alpha - (duration - 1) / duration) > 1e-8) throw new Error(`${cut.id}: クロスフェードの終端が不正です`);
          const halfway = await window.pv.renderFrame(boundary - Math.round(duration / 2));
          const seek = window.pv.snapshot();
          await window.pv.renderFrame(boundary - duration);
          for (let n = boundary - duration + 1; n <= boundary - Math.round(duration / 2); n++) await window.pv.renderFrame(n);
          if (seek !== window.pv.snapshot()) throw new Error(`${cut.id}: クロスフェード途中を再現できません`);
          result.push({ id: cut.id, frames: duration, fieldOnly: halfway.transition.fieldOnly });
        } else if (before.transition) throw new Error(`${cut.id}: クロスフェード除外区間にフェードがあります`);
      }
      return result;
    });
    results.push({ transitions });
    const presentation = await page.evaluate(async () => {
      const board = window.pv.board, fps = board.fps, fx = board.effects;
      const ctx = document.querySelector('#pv').getContext('2d'), result = [];
      const pixel = (x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data);
      for (const cut of board.cuts.filter(c => c.kind === 'story')) {
        const state = await window.pv.renderFrame(Math.round((cut.start + cut.review) * fps));
        if (pixel(100, 100).join(',') !== '0,0,0,255' || state.visual.portrait.x >= 960 || state.textBounds.some(t => t.x < 960)) throw new Error(`${cut.id}: 黒背景・みみこ左・セリフ右が未反映です`);
      }
      for (const cut of board.cuts.filter(c => c.kind === 'character' && c.presentationStart === undefined)) {
        const settled = await window.pv.renderFrame(Math.round((cut.start + cut.review) * fps));
        const field = settled.visual.field, portrait = settled.visual.portrait, scale = field.height / 452;
        const edges = [[field.x + 2 * scale, 540], [field.x + field.width - 2 * scale, 540],
          [field.x + field.width / 2, field.y + 2 * scale], [field.x + field.width / 2, field.y + field.height - 2 * scale]];
        const border = edges.map(([x, y]) => pixel(x, y));
        if (field.y < 24 || field.y + field.height > 1056 || border.some(p => p[0] < 140 || p[1] < 130 || p[2] < 170)) throw new Error(`${cut.id}: フィールドの四辺を確認できません`);
        const sizeMatches = cut.portraitWidth === undefined ? Math.abs(portrait.height - board.presentation.portraitHeight) < 0.01 : Math.abs(portrait.width - cut.portraitWidth) < 0.01;
        if (!sizeMatches || Math.abs(portrait.y + portrait.height / 2 - 540) > 0.01) throw new Error(`${cut.id}: 立ち絵のサイズ・上下中央が不一致です`);
        const index = board.cuts.indexOf(cut), onset = Math.round(cut.start * fps) - window.pv.incomingFrames(index);
        const nameAt = fx.portraitSlide + fx.nameDelay, quoteAt = nameAt + fx.quoteDelay;
        const pose = await window.pv.renderFrame(onset + Math.round(fx.portraitSlide * fps) - 1);
        const name = await window.pv.renderFrame(onset + Math.round((nameAt + 0.1) * fps));
        const quote = await window.pv.renderFrame(onset + Math.round((quoteAt + 0.1) * fps));
        if (pose.textBounds.length || !name.textBounds.some(t => t.role === 'name') || name.textBounds.some(t => t.role === 'quote') || !quote.textBounds.some(t => t.role === 'quote')) throw new Error(`${cut.id}: 立ち絵→名前→セリフの順になっていません`);
        const early = name.textBounds.find(t => t.role === 'name'), final = settled.textBounds.find(t => t.role === 'name');
        if (!(early.right - early.x > final.right - final.x && early.alpha < 1)) throw new Error(`${cut.id}: 名前の縮小・フェードが未反映です`);
        const movingQuote = quote.textBounds.find(t => t.role === 'quote'), finalQuote = settled.textBounds.find(t => t.role === 'quote');
        if (!(movingQuote.y > finalQuote.y && movingQuote.alpha < 1)) throw new Error(`${cut.id}: セリフの上昇・フェードが未反映です`);
        result.push({ id: cut.id, field, border, portrait, stagedEntrance: true });
      }
      return result;
    });
    results.push({ presentation });
    await writeFile(path.join(out, 'verification.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } else if (reviewOnly) {
    const sourceReview = path.join(reviewDir, 'source');
    await mkdir(sourceReview, { recursive: true });
    for (const cut of board.cuts) {
      const frame = Math.round((cut.start + cut.review) * board.fps);
      const result = await page.evaluate(n => window.pv.renderFrame(n), frame);
      const data = await page.evaluate(() => window.pv.snapshot());
      await writeFile(path.join(sourceReview, `${cut.id}.webp`), Buffer.from(data.split(',')[1], 'base64'));
      console.log(`${cut.id}: ${JSON.stringify(result.stats ?? {})}`);
    }
    await contactSheet(sourceReview, board.cuts.map(c => c.id));
  } else {
    const elementary = path.join(staging, `${filename}.h264`);
    const temporaryVideo = path.join(staging, `${filename}.mp4`);
    stream = await open(elementary, 'w');
    let progressAt = performance.now();
    await page.exposeFunction('pvWriteChunk', async (data, frame, cut) => {
      await stream.write(Buffer.from(data, 'base64'));
      if (performance.now() - progressAt > 15000 || frame === to) {
        console.log(`${frame - from}/${to - from} frames / ${cut} / ${((performance.now() - started) / 1000).toFixed(1)}秒`);
        progressAt = performance.now();
      }
    });
    const result = await page.evaluate(({ from, to }) => window.pv.encode(from, to), { from, to });
    await stream.close(); stream = undefined;
    if (pageErrors.length) throw new Error(pageErrors.join('\n'));
    const length = (to - from) / board.fps;
    const mux = ['-hide_banner', '-loglevel', 'error', '-y', '-fflags', '+genpts', '-r', String(board.fps), '-i', elementary];
    if (hasMusic) mux.push('-i', music, '-filter_complex', audio.filter);
    // ChromeはCanvasの描画経路によってH.264の色レンジを切り替えることがある。
    // ffmpegで統一し、カット境界でプレイヤーの色変換が切り替わるのを防ぐ。
    mux.push('-map', '0:v:0', '-vf', 'scale=out_range=tv:out_color_matrix=bt709,format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-threads', '1', '-r', String(board.fps), '-fps_mode', 'cfr',
      '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709');
    if (hasMusic) mux.push('-map', '[music]', '-c:a', 'aac', '-b:a', '256k');
    else mux.push('-an');
    mux.push('-t', String(length), '-movflags', '+faststart', temporaryVideo);
    await run('ffmpeg', mux);
    const probe = JSON.parse(await run('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', temporaryVideo]));
    const v = probe.streams.find(s => s.codec_type === 'video');
    if (v.width !== 1920 || v.height !== 1080 || v.avg_frame_rate !== '60/1' || v.pix_fmt !== 'yuv420p' || v.color_range !== 'tv' || Number(v.nb_read_frames) !== to - from || Math.abs(Number(probe.format.duration) - length) > 0.05) throw new Error('ffprobeの仕様検証に失敗しました');
    if ([v.color_space, v.color_primaries, v.color_transfer].some(tag => tag !== 'bt709')) throw new Error('色タグがBT.709に統一されていません');
    if (hasMusic !== probe.streams.some(s => s.codec_type === 'audio')) throw new Error('音声トラックの検証に失敗しました');
    if (result.stats.some(s => s.visibleHitFrames > 0)) throw new Error('被弾表示を検出しました');
    const reviewStaging = path.join(staging, 'review');
    await mkdir(reviewStaging);
    const reviewIds = [];
    for (const cut of board.cuts) {
      const at = cut.start + cut.review - from / board.fps;
      if (at < 0 || at >= length) continue;
      reviewIds.push(cut.id);
      const still = path.join(reviewStaging, cut.id);
      await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(at), '-i', temporaryVideo, '-frames:v', '1', `${still}.png`]);
      await run('cwebp', ['-quiet', '-q', '94', `${still}.png`, '-o', `${still}.webp`]);
      await unlink(`${still}.png`);
    }
    const trio = board.cuts.find(c => c.kind === 'cutin-trio');
    if (trio) for (const [index, member] of trio.members.entries()) {
      const at = (Math.round(member.start * board.fps) + Math.ceil(board.effects.trioSlide * board.fps) - from) / board.fps;
      if (at < 0 || at >= length) continue;
      const still = path.join(reviewStaging, `trio-${['top', 'middle', 'bottom'][index]}`);
      await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(at), '-i', temporaryVideo, '-frames:v', '1', `${still}.png`]);
      await run('cwebp', ['-quiet', '-q', '94', `${still}.png`, '-o', `${still}.webp`]);
      await unlink(`${still}.png`);
    }
    if (!partial && filename === 'kyoro-yako-pv') {
      const extract = async (id, at) => {
        const still = path.join(reviewStaging, id);
        await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(at), '-i', temporaryVideo, '-frames:v', '1', `${still}.png`]);
        await run('cwebp', ['-quiet', '-q', '94', `${still}.png`, '-o', `${still}.webp`]);
        await unlink(`${still}.png`);
      };
      await extract('opening-genre', board.cuts.find(c => c.id === 'opening').review);
      const story = board.cuts.find(c => c.id === 'letter'), fieldFit = board.cuts.find(c => c.id === 'neo');
      await extract('story', story.start + story.review);
      await extract('field-fit', fieldFit.start + fieldFit.review);
      await contactSheet(reviewStaging, ['rush-1', 'rush-2', 'rush-3'], 'rush', 3);
      const slide = board.cuts.find(c => c.id === 'neo');
      const onset = (Math.round(slide.start * board.fps) - Math.round(board.effects.crossfade * board.fps)) / board.fps;
      const ids = [];
      for (let i = 0; i < 5; i++) {
        const id = `slide-in-${i}`; ids.push(id);
        await extract(id, onset + i * 0.1);
      }
      await contactSheet(reviewStaging, ids, 'slide-in', 5);
      for (const id of ids) await unlink(path.join(reviewStaging, `${id}.webp`));
      const nameIds = [], nameAt = onset + board.effects.portraitSlide + board.effects.nameDelay;
      for (let i = 0; i < 5; i++) {
        const id = `name-motion-${i}`; nameIds.push(id);
        await extract(id, nameAt + i * 0.1);
      }
      await contactSheet(reviewStaging, nameIds, 'name-motion', 5);
      for (const id of nameIds) await unlink(path.join(reviewStaging, `${id}.webp`));
      const portraits = [];
      for (const id of ['gate', 'neo', 'etokichi', 'obsidia', 'chappy', 'claudine', 'jinrai', 'minerva']) {
        const cut = board.cuts.find(c => c.id === id), portraitId = `portrait-height-${id}`;
        const left = ['obsidia', 'claudine', 'etokichi', 'field-right'].includes(cut.layout);
        const still = path.join(reviewStaging, portraitId); portraits.push(portraitId);
        await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(cut.start + cut.review), '-i', temporaryVideo,
          '-vf', `crop=994:1080:${left ? 0 : 926}:0`, '-frames:v', '1', `${still}.png`]);
        await run('cwebp', ['-quiet', '-q', '94', `${still}.png`, '-o', `${still}.webp`]);
        await unlink(`${still}.png`);
      }
      await contactSheet(reviewStaging, portraits, 'portrait-heights', 8, { width: 497, height: 540 });
      for (const id of portraits) await unlink(path.join(reviewStaging, `${id}.webp`));
    }
    await contactSheet(reviewStaging, reviewIds);
    const elapsed = (performance.now() - started) / 1000;
    if (!partial && elapsed >= 900) {
      const warning = '書き出しの実時間が15分を超えました。動画の検証は成功しているため保存します';
      warnings.push(warning); console.warn(`警告: ${warning}`);
    }
    if (pageErrors.length) throw new Error(pageErrors.join('\n'));
    probe.format.filename = videoPath;
    const sourceAfter = await sourceVersion();
    if (source.srcCommit !== sourceAfter.srcCommit || source.diffSha256 !== sourceAfter.diffSha256) throw new Error('撮影中にsrcが変更されました。本編を置き換えず停止します。同じ本体で再実行してください');
    const report = { ...result, warnings, preflight, source, sourceAfter, musicSha256: hasMusic ? sha(await readFile(music)) : null,
      ffmpeg: (await run('ffmpeg', ['-version'])).split('\n')[0], audio: hasMusic ? audio : null,
      board: boardPath, boardSha256: sha(await readFile(boardPath)), videoPath, elapsedSeconds: elapsed, hasMusic, chrome: browser.version(), probe };
    const reportStaging = path.join(staging, `${filename}.report.json`);
    await writeFile(reportStaging, JSON.stringify(report, null, 2));
    if (args.includes('--clean')) await cleanOld();
    await mkdir(reviewDir, { recursive: true });
    for (const name of await readdir(reviewStaging)) await rename(path.join(reviewStaging, name), path.join(reviewDir, name));
    await rename(temporaryVideo, videoPath);
    await rename(reportStaging, path.join(out, `${filename}.report.json`));
    if (args.includes('--keep-intermediate')) await rename(elementary, path.join(out, `${filename}.h264`));
    console.log(JSON.stringify({ videoPath, elapsedSeconds: elapsed, hasMusic, width: v.width, height: v.height, fps: v.avg_frame_rate, frames: v.nb_read_frames, duration: probe.format.duration, stats: result.stats }, null, 2));
  }
  if (pageErrors.length) throw new Error(pageErrors.join('\n'));
} finally {
  await stream?.close();
  await browser?.close();
  if (staging) await rm(staging, { recursive: true, force: true });
  if (server) {
    // 起動したポートを名指しして止める。別セッションのサーバーを探さない。
    try { execFileSync('/bin/sh', ['-c', `lsof -tiTCP:${port} -sTCP:LISTEN | xargs kill`], { stdio: 'ignore' }); } catch { /* 起動失敗時はリスナーなし */ }
  }
}
