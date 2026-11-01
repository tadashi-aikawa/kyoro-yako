import { Capture } from './capture.js';
import { CharacterBackground } from './character-background.js';

const ease = n => 1 - (1 - Math.max(0, Math.min(1, n))) ** 3;

// カットをまたいで同じ撮影を進める。seek時はpage側で作り直す。
export class RushColumns {
  constructor(board) {
    this.board = board;
    this.shots = new Map();
    this.background = new CharacterBackground();
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1920; this.canvas.height = 1080;
  }

  async render(frame) {
    const b = this.board, c = this.canvas.getContext('2d');
    c.reset(); c.fillStyle = b.night; c.fillRect(0, 0, 1920, 1080);
    const columns = [], captures = [];
    for (const [index, cut] of b.cuts.filter(cut => cut.kind === 'gameplay-columns').entries()) {
      const local = frame - Math.round(cut.start * b.fps);
      if (local < 0) continue;
      let shot = this.shots.get(cut.id);
      if (!shot) { shot = new Capture(b.pixelRatio); await shot.begin(cut); this.shots.set(cut.id, shot); }
      while (shot.frame < local) {
        shot.step();
        if (shot.frame < local) shot.drawTo(c, 0, 0, 0);
      }
      const enter = ease(local / (b.presentation.rush.slide * b.fps));
      const x = index * 640, dx = index === 1 ? 0 : (1 - enter) * 640 * (index === 0 ? -1 : 1);
      const dy = index === 1 ? (1 - enter) * 1080 : 0;
      // 本体の内側1pxの枠も列間の線になるため、紹介と同様に除く。
      const height = 640 * 446 / 382, y = (1080 - height) / 2;
      c.save(); c.beginPath(); c.rect(x, 0, 640, 1080); c.clip(); c.translate(dx, dy);
      c.fillStyle = b.night; c.fillRect(x, 0, 640, 1080);
      c.save(); c.globalAlpha = b.presentation.characterBackground.opacity;
      const { brightness, blur } = b.presentation.characterBackground;
      c.drawImage(this.background.layer(cut.capture.stage, brightness, blur), 640, 0, 640, 1080, x, 0, 640, 1080);
      c.restore(); shot.drawTo(c, x, y, height, -1); c.restore();
      columns.push({ id: cut.id, stage: cut.capture.stage, frame: shot.frame, x, y, width: 640, height, dx, dy, enter });
      captures.push({ id: cut.id, stats: structuredClone(shot.stats) });
    }
    return { canvas: this.canvas, columns, captures };
  }
}
