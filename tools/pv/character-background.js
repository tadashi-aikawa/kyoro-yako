import { drawScenery } from '/src/stage-scenery.ts';
import { FIELD } from '/src/rules.ts';

// Renderer.drawField()と同じ背景層だけを使う。Gameや戦闘の時計は変更しない。
export class CharacterBackground {
  constructor() {
    this.layers = new Map();
  }

  layer(stage, brightness, blur) {
    const key = `${stage}:${brightness}:${blur}`;
    if (!this.layers.has(key)) {
      const padding = Math.max(96, Math.ceil(blur * 4)), width = 1920, height = 1080;
      const scenery = document.createElement('canvas');
      scenery.width = width + padding * 2; scenery.height = height + padding * 2;
      const c = scenery.getContext('2d');
      const scale = Math.max(scenery.width / FIELD.w, scenery.height / FIELD.h);
      c.translate((scenery.width - FIELD.w * scale) / 2, (scenery.height - FIELD.h * scale) / 2);
      c.scale(scale, scale);
      // 道中の固定位置。通常技→最終技でも同じ階の景色を維持する。
      drawScenery(c, { stage, sceneryDistance: 640, stageFrame: 1800, boss: null, phaseIndex: 0, phaseFrame: 0 });
      const layer = document.createElement('canvas'); layer.width = width; layer.height = height;
      const blurred = layer.getContext('2d');
      // 明るさを持ち上げてから出力座標でぼかす。余白で端の透明色の混入を防ぐ。
      blurred.filter = `${brightness === 1 ? '' : `brightness(${brightness}) `}blur(${blur}px)`;
      blurred.drawImage(scenery, -padding, -padding);
      this.layers.set(key, layer);
    }
    return this.layers.get(key);
  }

  draw(ctx, stage, field, { opacity = 0.25, brightness = 1, blur = 24 }) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, 1920, 1080);
    ctx.rect(field.x, field.y, field.width, field.height); ctx.clip('evenodd');
    ctx.globalAlpha = opacity;
    ctx.drawImage(this.layer(stage, brightness, blur), 0, 0);
    ctx.restore();
  }

  glow(ctx, color, centerX, centerY, height) {
    const radius = height * 0.8;
    const light = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    light.addColorStop(0, color); light.addColorStop(1, `${color}00`);
    ctx.save(); ctx.globalAlpha *= 0.25; ctx.fillStyle = light;
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
    ctx.restore();
  }
}
