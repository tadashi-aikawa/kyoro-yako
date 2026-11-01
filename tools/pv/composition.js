import { drawUltimateCutin, ultimateCutin } from '/src/ultimate-cutin.ts';
import { randomGenerator } from './capture.js';
import { CharacterBackground } from './character-background.js';

const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => 1 - (1 - clamp(n)) ** 3;
export const layouts = ['neo', 'obsidia', 'chappy', 'claudine', 'jinrai', 'etokichi', 'minerva', 'field-left', 'field-right', 'field-center'];
export function fieldRect(cut, board) {
  // 本体の枠線はFIELDの内側へ1px入る。その1pxを除き、縦横比を保つ。
  const height = 1080, width = height * 382 / 446;
  return { x: cut?.portraitSide === 'left' ? 1920 - width : 0, y: 0, width, height, padding: -1, feather: board.presentation.fieldFeather };
}

export class Composition {
  constructor(canvas, board) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    this.board = board;
    this.images = new Map();
    this.portraitCrops = new Map();
    this.characterBackground = new CharacterBackground();
    const random = randomGenerator(board.seed);
    this.stars = Array.from({ length: 170 }, () => [random() * 1920, random() * 1080, random() * 1.8 + 0.3, random() * 6.28]);
    this.textBounds = [];
  }

  async image(path) {
    if (!this.images.has(path)) {
      const image = new Image(); image.src = path;
      await image.decode(); this.images.set(path, image);
    }
    return this.images.get(path);
  }

  async prepare() {
    await Promise.all([this.board.keyVisual, '/assets/members/mimiko-stand.webp', ...this.board.cuts.flatMap(c => [c.portrait, ...(c.members ?? []).map(m => m.image)]).filter(Boolean)].map(path => this.image(path)));
    await document.fonts.ready;
    for (const path of new Set(['/assets/members/mimiko-stand.webp', ...this.board.cuts.map(c => c.portrait).filter(Boolean)])) {
      const image = this.images.get(path), scan = document.createElement('canvas');
      scan.width = image.width; scan.height = image.height;
      const ctx = scan.getContext('2d'); ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
      let x0 = image.width, y0 = image.height, x1 = -1, y1 = -1;
      for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        if (pixels[(y * image.width + x) * 4 + 3] <= 12) continue;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      if (x1 < x0) throw new Error(`立ち絵が透明です: ${path}`);
      this.portraitCrops.set(path, { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 });
    }
  }

  text(value, x, y, size, color = '#fff2da', width = 850, align = 'left', latin = false, shadow = { color: '#080817', blur: 8 }, style = {}) {
    if (!value || this.ctx.globalAlpha <= 0) return;
    const c = this.ctx;
    c.letterSpacing = `${style.spacing ?? 0}px`;
    c.font = `${style.weight ?? 400} ${size}px ${latin ? this.board.latinFont : this.board.font}`;
    const measured = c.measureText(value).width;
    const actual = Math.min(size, size * width / Math.max(1, measured));
    c.font = `${style.weight ?? 400} ${actual}px ${latin ? this.board.latinFont : this.board.font}`;
    c.textAlign = align; c.textBaseline = 'alphabetic';
    c.fillStyle = color;
    const metrics = c.measureText(value);
    const left = align === 'center' ? x - metrics.width / 2 : align === 'right' ? x - metrics.width : x;
    const transform = c.getTransform();
    const topLeft = transform.transformPoint({ x: left, y: y - metrics.actualBoundingBoxAscent });
    const bottomRight = transform.transformPoint({ x: left + metrics.width, y: y + metrics.actualBoundingBoxDescent });
    const bound = { text: value, x: topLeft.x, y: topLeft.y, right: bottomRight.x, bottom: bottomRight.y, size: actual, role: this.textRole, alpha: c.globalAlpha };
    this.textBounds.push(bound);
    if (bound.x < 24 || bound.y < 24 || bound.right > 1896 || bound.bottom > 1056) throw new Error(`文字がセーフエリア外: ${value}`);
    c.save(); c.shadowColor = shadow?.color ?? 'transparent'; c.shadowBlur = shadow?.blur ?? 0;
    c.shadowOffsetY = shadow?.offsetY ?? 0;
    for (let i = 0; i < (shadow?.passes ?? 1); i++) c.fillText(value, x, y);
    c.restore();
  }

  paragraph(value, x, y, size, width, color = '#fff2da') {
    if (!value) return;
    const c = this.ctx; c.font = `${size}px ${this.board.font}`;
    c.letterSpacing = '0px';
    let line = '', row = 0;
    for (const char of value) {
      if (c.measureText(line + char).width > width && line && !'。、！？）」』'.includes(char)) { this.text(line, x, y + row++ * size * 1.65, size, color, width); line = ''; }
      line += char;
    }
    this.text(line, x, y + row * size * 1.65, size, color, width);
  }

  vertical(value, x, y, size, color = '#fff2da') {
    const vertical = value.replaceAll('…', '︙').replaceAll('、', '︑').replaceAll('。', '︒');
    [...vertical].forEach((char, i) => this.text(char, x, y + i * size * 1.12, size, color, size * 1.4, 'center'));
  }

  portrait(path, x, y, w, h, alpha = 1) {
    const c = this.ctx, image = this.images.get(path);
    c.save(); c.globalAlpha *= alpha;
    const scale = Math.min(w / image.width, h / image.height);
    c.drawImage(image, x + (w - image.width * scale) / 2, y, image.width * scale, image.height * scale);
    c.restore();
  }

  standingPortrait(path, centerX, centerY, height, fitWidth) {
    const crop = this.portraitCrops.get(path), width = fitWidth ?? height * crop.width / crop.height;
    if (fitWidth !== undefined) height = width * crop.height / crop.width;
    const bounds = { x: centerX - width / 2, y: centerY - height / 2, width, height };
    this.ctx.drawImage(this.images.get(path), crop.x, crop.y, crop.width, crop.height, bounds.x, bounds.y, width, height);
    const position = this.ctx.getTransform().transformPoint(bounds);
    this.visual.portrait = { ...bounds, x: position.x, y: position.y };
  }

  night(time, color = this.board.gold) {
    const c = this.ctx;
    c.fillStyle = this.board.night; c.fillRect(0, 0, 1920, 1080);
    for (const [x, y, r, phase] of this.stars) {
      c.fillStyle = color; c.globalAlpha = 0.14 + (Math.sin(time * 0.4 + phase) + 1) * 0.13;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
  }

  keyVisual(time, alpha = 1) {
    const c = this.ctx, image = this.images.get(this.board.keyVisual);
    const scale = 1080 / image.height * (1 + time * 0.0017);
    c.save(); c.globalAlpha = alpha;
    c.drawImage(image, 1920 - image.width * scale + time * 0.7, (1080 - image.height * scale) / 2, image.width * scale, image.height * scale);
    const shade = c.createLinearGradient(400, 0, 1100, 0);
    shade.addColorStop(0, this.board.night); shade.addColorStop(1, '#08081700');
    c.fillStyle = shade; c.fillRect(0, 0, 1100, 1080);
    c.restore();
  }

  drawField(capture, field) {
    if (!this.fieldCanvas) this.fieldCanvas = document.createElement('canvas');
    if (this.fieldCanvas.width !== Math.ceil(field.width) || this.fieldCanvas.height !== field.height) {
      this.fieldCanvas.width = Math.ceil(field.width); this.fieldCanvas.height = field.height;
    }
    const c = this.fieldCanvas.getContext('2d', { willReadFrequently: true });
    c.reset();
    capture.drawTo(c, 0, 0, field.height, field.padding);
    c.globalCompositeOperation = 'destination-in';
    const mask = field.x > 0 ? c.createLinearGradient(field.feather, 0, 0, 0)
      : c.createLinearGradient(field.width - field.feather, 0, field.width, 0);
    mask.addColorStop(0, '#fff'); mask.addColorStop(1, '#fff0');
    c.fillStyle = mask; c.fillRect(0, 0, this.fieldCanvas.width, field.height);
    this.ctx.drawImage(this.fieldCanvas, field.x, field.y);
  }

  character(cut, local, capture) {
    const c = this.ctx, color = cut.color, field = fieldRect(cut, this.board);
    const background = this.board.presentation.characterBackground ?? {};
    const showBackground = background.enabled === true && cut.kind === 'character';
    if (showBackground) {
      this.characterBackground.draw(c, cut.capture.stage, field, background);
      this.visual.background = { stage: cut.capture.stage, opacity: background.opacity ?? 0.25, brightness: background.brightness ?? 1, blur: background.blur ?? 24 };
    }
    this.drawField(capture, field);
    this.visual.field = field;
    const fx = this.board.effects;
    const left = cut.portraitSide === 'left', panelX = left ? 0 : field.width, panelWidth = 1920 - field.width;
    const enter = ease(local / fx.portraitSlide), drift = (1 - enter) * fx.portraitDistance * (left ? -1 : 1);
    const center = panelX + panelWidth / 2, textX = panelX + 75;
    this.visual.panel = { x: panelX, width: panelWidth, side: left ? 'left' : 'right' };
    c.save(); c.beginPath(); c.rect(panelX, 0, panelWidth, 1080); c.clip(); c.translate(drift, 0);
    if (showBackground) {
      const crop = this.portraitCrops.get(cut.portrait);
      const height = cut.portraitWidth === undefined ? this.board.presentation.portraitHeight : cut.portraitWidth * crop.height / crop.width;
      this.characterBackground.glow(c, color, center, 540, height);
    }
    this.standingPortrait(cut.portrait, center, 540, this.board.presentation.portraitHeight, cut.portraitWidth);
    c.restore();
    // 顔を文字から離し、立ち絵の下端を暗幕に沈めて文字を読ませる。
    const shade = c.createLinearGradient(0, 720, 0, 1080);
    shade.addColorStop(0, '#08081700'); shade.addColorStop(0.7, '#080817eb'); shade.addColorStop(1, this.board.night);
    c.fillStyle = shade; c.fillRect(panelX, 720, panelWidth, 360);
    const nameAt = fx.portraitSlide + fx.nameDelay, quoteAt = nameAt + fx.nameDuration + fx.quoteDelay;
    const nameAge = local - nameAt, nameEnter = ease(nameAge / fx.nameDuration);
    const scale = 1 + (fx.nameScale - 1) * (1 - nameEnter);
    const impact = nameAge >= fx.nameDuration ? 1 - clamp((nameAge - fx.nameDuration) / fx.nameImpact) : 0;
    const letters = [...cut.quote], count = Math.min(letters.length, Math.floor(Math.max(0, local - quoteAt) / fx.quoteCharacter + 1e-8));
    this.visual.motion = { portrait: enter, name: nameEnter, nameScale: scale, impact, quoteChars: count, quote: count / letters.length };
    const pivot = [center, 825];
    c.save(); c.globalAlpha = clamp(nameAge / fx.nameDuration);
    c.translate(...pivot); c.scale(scale, scale); c.translate(-pivot[0], -pivot[1]);
    this.textRole = 'name';
    const nameWidth = (panelWidth - 96) / fx.nameScale;
    this.text(cut.name, center, 825, 110, color, nameWidth, 'center', false, { color: '#02020a', blur: 18, passes: 2 });
    if (impact > 0) this.text(cut.name, center, 825, 110, color, nameWidth, 'center', false, { color, blur: 20 * impact });
    c.restore();
    c.save();
    this.textRole = 'quote';
    // 最終文の幅でサイズを決め、文字が増えても既出の文字を動かさない。
    c.letterSpacing = '0px'; c.font = `34px ${this.board.font}`;
    const quoteSize = Math.min(34, 34 * 850 / Math.max(1, c.measureText(cut.quote).width));
    this.text(letters.slice(0, count).join(''), textX, 920, quoteSize, '#fff2da', 850, 'left', false, { color: '#02020a', blur: 12, passes: 2 });
    this.textRole = undefined;
    // 技名は撮影フェーズの照合にも使う。キャラ紹介では描かない。
    if (cut.kind !== 'character') this.text(cut.spell, textX, 1025, 48, '#fff2da', 830);
    c.restore();
  }

  cutinTrio(cut, local) {
    const c = this.ctx;
    c.fillStyle = this.board.night; c.fillRect(0, 0, 1920, 1080);
    // 顔を含む横長の領域を各360pxへ縮小する。文字は重ねない。
    cut.members.forEach((member, i) => {
      const elapsed = local - (Math.round(member.start * this.board.fps) - Math.round(cut.start * this.board.fps)) / this.board.fps;
      if (elapsed < 0) return;
      const image = this.images.get(member.image), y = i * 360;
      const shift = (1 - ease(elapsed / this.board.effects.trioSlide)) * 1920 * (member.direction === 'left' ? -1 : 1);
      c.save(); c.beginPath(); c.rect(0, y, 1920, 360); c.clip();
      c.translate(shift, 0);
      c.fillStyle = member.background; c.fillRect(0, y, 1920, 360);
      const scale = 360 / member.cropHeight;
      c.drawImage(image, 0, member.cropY, image.width, member.cropHeight,
        960 - member.faceX * scale, y, image.width * scale, 360);
      c.restore();
    });
  }

  async draw(cut, localFrame, durationFrames, capture, timelineTime = cut.start + localFrame / this.board.fps) {
    const c = this.ctx, b = this.board, local = localFrame / b.fps, time = timelineTime;
    // Canvasの描画状態と前フレームの画素を残さず、seekでも同じ合成順にする。
    c.reset();
    this.textBounds = [];
    this.visual = {};
    this.night(time, cut.color);
    if (cut.kind === 'gameplay') {
      capture.drawTo(c, (1920 - 1080 * 384 / 448) / 2);
    } else if (cut.capture) {
      const presentation = local + (Math.round(cut.start * b.fps) - Math.round((cut.presentationStart ?? cut.start) * b.fps)) / b.fps;
      this.character(cut, presentation, capture);
      if (cut.kind === 'cutin') {
        const g = capture.game, spec = ultimateCutin(g.boss, g.phase?.pattern);
        if (!spec || g.cutin <= 0) throw new Error(`${cut.id}: 専用カットインの撮影可能時間を超えました`);
        if (spec && g.cutin > 0) {
          this.night(time, cut.color);
          // 本編の専用カットインを縦横比のまま重ねる。冒険ノートは含まない。
          c.save(); c.translate(240, 0); c.scale(2.25, 2.25);
          drawUltimateCutin(c, g.images[`${g.boss}-ultimate`], g.cutin, spec, g.ultimateFrame);
          c.restore();
        }
      }
      if (cut.kind === 'defeat' && capture.game.postBoss) {
        c.fillStyle = `rgba(255,255,255,${Math.max(capture.game.flash / 8, capture.game.whiteAlpha)})`;
        c.fillRect(0, 0, 1920, 1080);
      }
    } else if (cut.kind === 'cutin-trio') {
      this.cutinTrio(cut, local);
    } else if (cut.kind === 'opening') {
      this.keyVisual(local, clamp(local / 4));
      c.save(); c.globalAlpha = clamp((local - b.effects.titleAt) / b.effects.titleFade);
      this.text(b.title, 130, 505, 154, '#fff0cd', 800);
      this.text(b.reading, 145, 575, 34, b.gold, 750);
      c.restore();
      c.save(); c.globalAlpha = clamp((local - b.effects.titleAt - b.effects.genreDelay) / b.effects.genreFade);
      b.genreText.replace('弾幕', '\n弾幕').split('\n').forEach((line, i) => this.text(line, 140, 835 + i * 65, 42, '#fff2da', 850));
      c.restore();
      c.fillStyle = `rgba(0,0,0,${1 - clamp(local / 2.5)})`; c.fillRect(0, 0, 1920, 1080);
    } else if (cut.kind === 'story') {
      const storyStart = b.cuts.find(cut => cut.kind === 'story').start;
      const background = 1 - ease((time - storyStart) / b.effects.storyFade);
      c.fillStyle = '#000'; c.fillRect(0, 0, 1920, 1080);
      this.keyVisual(time, background);
      this.visual.storyBackground = background;
      this.standingPortrait('/assets/members/mimiko-stand.webp', 470, 540, 560);
      this.visual.storyLines = [];
      cut.text.forEach((line, i) => {
        const alpha = clamp((local - i * b.effects.storyLineFade) / b.effects.storyLineFade);
        const y = 460 + i * 140 + (1 - alpha) * b.effects.storyDrift;
        this.visual.storyLines.push({ text: line, alpha, y });
        c.save(); c.globalAlpha = alpha;
        this.text(line, 960, y, 44, '#dfe4f0', 870, 'left', false, { color: '#bdc9e355', blur: 6 }, { weight: 300, spacing: 4.4 });
        c.restore();
      });
    } else if (cut.kind === 'dawn' || cut.kind === 'announcement') {
      const count = Math.round(b.ending.duration * b.fps);
      const index = cut.kind === 'announcement' ? count - 1 : Math.min(count - 1, localFrame);
      const sky = await this.image(`/_Unversioned/pv/ending/${String(index + 1).padStart(4, '0')}.webp`);
      c.drawImage(sky, 0, 0, 1920, 1080);
      if (cut.kind === 'announcement') {
        c.save(); c.globalAlpha = clamp(local / b.effects.announcementFade);
        c.fillStyle = '#10142540'; c.fillRect(0, 0, 1920, 1080);
        const titleShadow = { color: '#160f25', blur: 20, offsetY: 4, passes: 2 };
        this.text(b.title, 960, 465, 160, '#fff0cd', 1600, 'center', false, titleShadow);
        this.text(b.reading, 960, 535, 32, '#2a2338', 1600, 'center', false, null);
        c.restore();
        c.save(); c.globalAlpha = clamp((local - b.effects.announcementDateAt) / b.effects.announcementFade);
        this.text(b.release, 960, 690, 48, '#2a2338', 1600, 'center', false, null);
        c.restore();
        c.save(); c.globalAlpha = clamp((local - b.effects.announcementAuthorAt) / b.effects.announcementFade);
        this.text(b.author, 960, 790, 34, '#2a2338', 1600, 'center', true, null);
        c.restore();
        const remain = (durationFrames - localFrame) / b.fps;
        c.fillStyle = `rgba(0,0,0,${1 - clamp((remain - 1 / b.fps) / 1.5)})`; c.fillRect(0, 0, 1920, 1080);
      }
    }
    const flash = cut.flashIn ?? (cut.transition === 'flash' ? (cut.kind === 'gameplay' ? b.effects.rushFlash : b.effects.chorusFlash) : 0);
    if (flash) {
      c.fillStyle = `rgba(255,255,255,${1 - clamp(local / flash)})`;
      c.fillRect(0, 0, 1920, 1080);
    }
  }
}
