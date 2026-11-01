import { drawUltimateCutin, ultimateCutin } from '/src/ultimate-cutin.ts';
import { randomGenerator } from './capture.js';

const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => 1 - (1 - clamp(n)) ** 3;
export const layouts = ['neo', 'obsidia', 'chappy', 'claudine', 'jinrai', 'etokichi', 'minerva', 'field-left', 'field-right', 'field-center'];
const fieldOnRight = cut => ['obsidia', 'claudine', 'etokichi', 'field-right'].includes(cut.layout);
export function fieldRect(cut, board) {
  const height = board.presentation.fieldHeight, width = height * 388 / 452;
  return { x: fieldOnRight(cut) ? 1920 - board.presentation.fieldMargin - width : board.presentation.fieldMargin,
    y: (1080 - height) / 2, width, height, padding: 2 };
}

export class Composition {
  constructor(canvas, board) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    this.board = board;
    this.images = new Map();
    this.portraitCrops = new Map();
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

  text(value, x, y, size, color = '#fff2da', width = 850, align = 'left', latin = false, shadow = { color: '#080817', blur: 8 }) {
    if (!value || this.ctx.globalAlpha <= 0) return;
    const c = this.ctx;
    c.font = `${size}px ${latin ? this.board.latinFont : this.board.font}`;
    const measured = c.measureText(value).width;
    const actual = Math.min(size, size * width / Math.max(1, measured));
    c.font = `${actual}px ${latin ? this.board.latinFont : this.board.font}`;
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

  standingPortrait(path, centerX, centerY, height) {
    const crop = this.portraitCrops.get(path), width = height * crop.width / crop.height;
    const bounds = { x: centerX - width / 2, y: centerY - height / 2, width, height };
    this.ctx.drawImage(this.images.get(path), crop.x, crop.y, crop.width, crop.height, bounds.x, bounds.y, width, height);
    this.visual.portrait = bounds;
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

  character(cut, local, capture) {
    const c = this.ctx, color = cut.color;
    const right = fieldOnRight(cut), field = fieldRect(cut, this.board);
    capture.drawTo(c, field.x, field.y, field.height, field.padding);
    this.visual.field = field;
    const fx = this.board.effects;
    const enter = ease(local / fx.portraitSlide), drift = (1 - enter) * fx.portraitDistance * (right ? -1 : 1);
    c.save(); c.beginPath(); c.rect(right ? 0 : 926, 0, 994, 1080); c.clip(); c.translate(drift, 0);
    const center = { obsidia: 450, chappy: 1570, claudine: 450, jinrai: 1490, etokichi: 490, minerva: 1440 }[cut.layout] ?? (right ? 490 : 1460);
    this.standingPortrait(cut.portrait, center, 540, this.board.presentation.portraitHeight);
    c.restore();
    // 顔を文字から離し、立ち絵の下端を暗幕に沈めて文字を読ませる。
    const shade = c.createLinearGradient(0, 720, 0, 1080);
    shade.addColorStop(0, '#08081700'); shade.addColorStop(0.7, '#080817eb'); shade.addColorStop(1, this.board.night);
    c.fillStyle = shade; c.fillRect(right ? 0 : 926, 720, 994, 360);
    const nameAt = fx.portraitSlide + fx.nameDelay, quoteAt = nameAt + fx.quoteDelay;
    const nameEnter = ease((local - nameAt) / fx.nameDuration), quoteEnter = ease((local - quoteAt) / fx.quoteDuration);
    this.visual.motion = { portrait: enter, name: nameEnter, quote: quoteEnter };
    const pivot = { chappy: [1010, 130], jinrai: [1110, 340], etokichi: [490, 130], minerva: [1835, 360] }[cut.layout] ?? [right ? 75 : 1010, 815];
    const scale = 1 + (fx.nameScale - 1) * (1 - nameEnter);
    c.save(); c.globalAlpha = nameEnter;
    c.translate(...pivot); c.scale(scale, scale); c.translate(-pivot[0], -pivot[1]);
    this.textRole = 'name';
    switch (cut.layout) {
      case 'obsidia':
        this.text(cut.name, 75, 835, 104, color, 830); break;
      case 'chappy':
        this.text(cut.name, 1010, 130, 94, color); break;
      case 'claudine':
        this.text(cut.name, 75, 825, 110, color, 830); break;
      case 'jinrai':
        this.vertical(cut.name, 1110, 255, 150, color); break;
      case 'etokichi':
        this.text(cut.name, 490, 130, 100, color, 820, 'center'); break;
      case 'minerva':
        this.vertical(cut.name, 1835, 190, 78, color); break;
      default: this.text(cut.name, right ? 75 : 1010, 815, cut.layout === 'neo' ? 160 : 100, color, 830);
    }
    c.restore();
    c.save(); c.globalAlpha = quoteEnter; c.translate(0, (1 - quoteEnter) * fx.quoteDistance);
    this.textRole = 'quote';
    switch (cut.layout) {
      case 'obsidia': this.paragraph(cut.quote, 75, 930, 34, 830); break;
      case 'chappy': this.paragraph(cut.quote, 1010, 760, 36, 330); break;
      case 'claudine': this.text(cut.quote, 75, 920, 34, '#fff2da', 830); break;
      case 'jinrai': this.vertical(cut.quote, 1840, 160, 32); break;
      case 'etokichi': this.text(cut.quote, 490, 990, 36, '#fff2da', 850, 'center'); break;
      case 'minerva': this.paragraph(cut.quote, 1010, 865, 34, 800); break;
      default: this.paragraph(cut.quote, right ? 75 : 1010, 920, 36, 830);
    }
    this.textRole = undefined;
    // 技名は撮影フェーズの照合にも使う。キャラ紹介では描かない。
    if (cut.kind !== 'character') this.text(cut.spell, right ? 75 : 1010, 1025, 48, '#fff2da', 830);
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
      c.save(); c.globalAlpha = clamp(local / 0.55);
      cut.text.forEach((line, i) => this.text(line, 960, 475 + i * 100, 44, '#fff2da', 850));
      c.restore();
    } else if (cut.kind === 'dawn' || cut.kind === 'announcement') {
      const count = Math.round(b.ending.duration * b.fps);
      const index = cut.kind === 'announcement' ? count - 1 : Math.min(count - 1, localFrame);
      const sky = await this.image(`/_Unversioned/pv/ending/${String(index + 1).padStart(4, '0')}.webp`);
      c.drawImage(sky, 0, 0, 1920, 1080);
      if (cut.kind === 'announcement') {
        c.save(); c.globalAlpha = clamp(local / 0.8);
        c.fillStyle = '#10142540'; c.fillRect(0, 0, 1920, 1080);
        const titleShadow = { color: '#160f25', blur: 20, offsetY: 4, passes: 2 };
        this.text(b.title, 960, 465, 160, '#fff0cd', 1600, 'center', false, titleShadow);
        this.text(b.reading, 960, 535, 32, '#2a2338', 1600, 'center', false, null);
        this.text(b.release, 960, 690, 48, '#2a2338', 1600, 'center', false, null);
        this.text(b.url, 960, 790, 34, '#2a2338', 1600, 'center', true, null);
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
