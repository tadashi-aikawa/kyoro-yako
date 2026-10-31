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

async function sourceVersion() {
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
}

async function contactSheet(directory, ids) {
  if (!ids.length) return;
  const list = path.join(directory, 'contact.txt');
  await writeFile(list, ids.map(id => `file '${id}.webp'`).join('\n'));
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', `scale=640:360,tile=3x${Math.ceil(ids.length / 3)}:color=0x080817`, '-frames:v', '1', path.join(directory, 'contact.png')]);
  await run('cwebp', ['-quiet', '-q', '90', path.join(directory, 'contact.png'), '-o', path.join(directory, 'contact.webp')]);
  await unlink(list); await unlink(path.join(directory, 'contact.png'));
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
  // 自分で起動した専用ポートだけを管理する。既存サーバーには接続しない。
  const occupied = await run('lsof', ['-ti', `tcp:${port}`]).then(s => s.trim(), () => '');
  if (occupied) throw new Error(`ポート${port}は使用中です。--portで空きポートを指定してください`);
  server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--config', path.join(here, 'vite.config.mjs'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
  let serverLog = '';
  server.stderr.on('data', b => { serverLog += b; });
  server.on('error', e => { serverLog += e.message; });
  for (let i = 0; i < 100; i++) {
    if (await fetch(url).then(r => r.ok, () => false)) break;
    if (server.exitCode !== null || i === 99) throw new Error(`Viteを起動できません: ${serverLog}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
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
    for (const id of ['neo', 'chappy', 'bloom', 'announcement']) {
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
    for (const [id, duration] of [['issen-cutin', 4], ['chappy', 6]]) {
      const invalid = structuredClone(board);
      invalid.duration = duration;
      invalid.cuts = [{ ...invalid.cuts.find(c => c.id === id), start: 0 }];
      await page.evaluate(b => window.pv.configure(b), invalid);
      const error = await page.evaluate(async () => {
        try { await window.pv.preflight(); return ''; } catch (e) { return e.message; }
      });
      if (!error.includes(`事前検査 ${id}:`)) throw new Error(`${id}: 撮影時間超過を検出できません`);
      results.push({ id, overrunRejected: true, error });
    }
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
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-r', String(board.fps), '-fps_mode', 'cfr',
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
    await contactSheet(reviewStaging, reviewIds);
    const elapsed = (performance.now() - started) / 1000;
    if (!partial && elapsed >= 900) {
      const warning = '書き出しの実時間が15分を超えました。動画の検証は成功しているため保存します';
      warnings.push(warning); console.warn(`警告: ${warning}`);
    }
    if (pageErrors.length) throw new Error(pageErrors.join('\n'));
    probe.format.filename = videoPath;
    const report = { ...result, warnings, preflight, source, sourceAfter: await sourceVersion(), musicSha256: hasMusic ? sha(await readFile(music)) : null,
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
