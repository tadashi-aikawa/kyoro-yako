import { drawUltimateCutin, ultimateCutin } from '/src/ultimate-cutin.ts';
import { randomGenerator } from './capture.js';

const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => 1 - (1 - clamp(n)) ** 3;
export const layouts = ['neo', 'obsidia', 'chappy', 'claudine', 'jinrai', 'etokichi', 'minerva', 'field-left', 'field-right'];

export class Composition {
  constructor(canvas, board) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    this.board = board;
    this.images = new Map();
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
  }

  text(value, x, y, size, color = '#fff2da', width = 850, align = 'left', latin = false, shadow = { color: '#080817', blur: 8 }) {
    if (!value) return;
    const c = this.ctx;
    c.font = `${size}px ${latin ? this.board.latinFont : this.board.font}`;
    const measured = c.measureText(value).width;
    const actual = Math.min(size, size * width / Math.max(1, measured));
    c.font = `${actual}px ${latin ? this.board.latinFont : this.board.font}`;
    c.textAlign = align; c.textBaseline = 'alphabetic';
    c.fillStyle = color;
    const metrics = c.measureText(value);
    const left = align === 'center' ? x - metrics.width / 2 : align === 'right' ? x - metrics.width : x;
    const bound = { text: value, x: left, y: y - metrics.actualBoundingBoxAscent, right: left + metrics.width, bottom: y + metrics.actualBoundingBoxDescent, size: actual };
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
    const right = ['obsidia', 'claudine', 'etokichi', 'field-right'].includes(cut.layout);
    capture.drawTo(c, right ? 994.285714 : 0);
    const enter = ease(local / 0.45), drift = (1 - enter) * (right ? -36 : 36);
    c.save(); c.translate(drift, 0); c.globalAlpha = enter;
    // 動かすのは立ち絵だけ。文字の位置はカットを通して固定する。
    switch (cut.layout) {
      case 'obsidia': this.portrait(cut.portrait, 22, 110, 710, 1065); break;
      case 'chappy': this.portrait(cut.portrait, 1410, 240, 440, 710); break;
      case 'claudine': this.portrait(cut.portrait, -100, 20, 860, 1290); break;
      case 'jinrai': this.portrait(cut.portrait, 1220, 100, 560, 840); break;
      case 'etokichi': this.portrait(cut.portrait, 130, 195, 720, 680); break;
      case 'minerva': this.portrait(cut.portrait, 1060, 65, 780, 1170); break;
      default: this.portrait(cut.portrait, right ? 160 : 1215, 35, 700, 1050); break;
    }
    c.restore();
    // 顔を文字から離し、立ち絵の下端を暗幕に沈めて文字を読ませる。
    const shade = c.createLinearGradient(0, 720, 0, 1080);
    shade.addColorStop(0, '#08081700'); shade.addColorStop(0.7, '#080817eb'); shade.addColorStop(1, this.board.night);
    c.fillStyle = shade; c.fillRect(right ? 0 : 926, 720, 994, 360);
    c.save(); c.globalAlpha = enter;
    if (cut.kind === 'genre') {
      this.paragraph(cut.text, 75, 825, 62, 830);
      c.restore();
      return;
    }
    switch (cut.layout) {
      case 'obsidia':
        this.text(cut.name, 75, 835, 104, color, 830);
        this.paragraph(cut.quote, 75, 930, 34, 830); break;
      case 'chappy':
        this.text(cut.name, 1010, 185, 98, color);
        this.paragraph(cut.quote, 1010, 760, 36, 380); break;
      case 'claudine':
        this.text(cut.name, 75, 825, 110, color, 830);
        this.text(cut.quote, 75, 920, 34, '#fff2da', 830); break;
      case 'jinrai':
        this.vertical(cut.name, 1110, 255, 150, color);
        this.vertical(cut.quote, 1840, 160, 32); break;
      case 'etokichi':
        this.text(cut.name, 490, 185, 110, color, 820, 'center');
        this.text(cut.quote, 490, 920, 36, '#fff2da', 850, 'center'); break;
      case 'minerva':
        this.vertical(cut.name, 1835, 190, 78, color);
        this.paragraph(cut.quote, 1010, 865, 34, 800); break;
      default: {
        const x = right ? 75 : 1010;
        this.text(cut.name, x, 815, cut.layout === 'neo' ? 160 : 100, color, 830);
        this.paragraph(cut.quote, x, 920, 36, 830);
      }
    }
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
      const shift = (1 - ease(elapsed / 0.25)) * 1920 * (member.direction === 'left' ? -1 : 1);
      c.save(); c.beginPath(); c.rect(0, y, 1920, 360); c.clip();
      c.translate(shift, 0);
      c.fillStyle = member.background; c.fillRect(0, y, 1920, 360);
      const scale = 360 / member.cropHeight;
      c.drawImage(image, 0, member.cropY, image.width, member.cropHeight,
        member.x, y, image.width * scale, 360);
      c.restore();
    });
  }

  async draw(cut, localFrame, durationFrames, capture) {
    const c = this.ctx, b = this.board, local = localFrame / b.fps, time = cut.start + local;
    // Canvasの描画状態と前フレームの画素を残さず、seekでも同じ合成順にする。
    c.reset();
    this.textBounds = [];
    this.night(time, cut.color);
    if (cut.capture) {
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
      c.save(); c.globalAlpha = clamp((local - 3) / 3);
      this.text(b.title, 130, 505, 154, '#fff0cd', 800);
      this.text(b.reading, 145, 575, 34, b.gold, 750);
      c.restore();
      c.fillStyle = `rgba(0,0,0,${1 - clamp(local / 2.5)})`; c.fillRect(0, 0, 1920, 1080);
    } else if (cut.kind === 'story') {
      this.keyVisual(time, 0.28);
      this.portrait('/assets/members/mimiko-stand.webp', 1230, 275, 520, 520, 0.9);
      c.save(); c.globalAlpha = clamp(local / 0.55);
      cut.text.forEach((line, i) => this.text(line, 130, 475 + i * 100, 48, '#fff2da', 1100));
      c.restore();
    } else if (cut.kind === 'dawn' || cut.kind === 'announcement') {
      const count = Math.round(b.ending.duration * b.fps);
      const index = cut.kind === 'announcement' ? count - 1 : Math.min(count - 1, localFrame);
      const sky = await this.image(`/_Unversioned/pv/ending/${String(index + 1).padStart(4, '0')}.webp`);
      c.drawImage(sky, 0, 0, 1920, 1080);
      if (cut.kind === 'dawn') {
        c.fillStyle = `rgba(255,255,255,${1 - clamp(local / 0.8)})`; c.fillRect(0, 0, 1920, 1080);
      } else {
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
    if (cut.flashIn) {
      c.fillStyle = `rgba(255,255,255,${1 - clamp(local / cut.flashIn)})`;
      c.fillRect(0, 0, 1920, 1080);
    }
  }
}
