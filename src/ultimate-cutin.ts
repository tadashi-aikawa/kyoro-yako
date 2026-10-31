// 迅雷一閃だけの試作。通常の100フレームのカットインとは別の時計で描く。
export const ULTIMATE_CUTIN_FRAMES = 150;
export const ULTIMATE_SECOND_STAMP = 12;
export const ULTIMATE_TITLE = 64;

const FONT = '"YuMincho", "Yu Mincho", "Hiragino Mincho ProN", serif';
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const easeOut = (value: number): number => 1 - (1 - clamp(value)) ** 3;

function glyph(c: CanvasRenderingContext2D, text: string, age: number, x: number, y: number, size: number, color: string): void {
  if (age < 0) return;
  const impact = 1 - easeOut(age / 7);
  c.save();
  c.translate(x + impact * 10, y - impact * 9);
  c.scale(1 + impact * 1.4, 1 + impact * 1.4);
  c.globalAlpha *= clamp(age / 2);
  c.font = `900 ${size}px ${FONT}`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = 5; c.strokeStyle = '#0d0a05';
  c.strokeText(text, 0, 0);
  c.fillStyle = color; c.fillText(text, 0, 0);
  c.restore();
}

export function drawUltimateCutin(c: CanvasRenderingContext2D, image: HTMLImageElement | undefined, remaining: number): void {
  const age = ULTIMATE_CUTIN_FRAMES - remaining;
  const reveal = easeOut((age - 28) / 22);
  const leave = easeOut((age - 130) / 20);
  const stamp = age >= ULTIMATE_SECOND_STAMP ? age - ULTIMATE_SECOND_STAMP : age;
  const shake = Math.max(0, 5 - stamp) * Math.sin(age * 2.7);
  c.save();
  c.beginPath(); c.rect(0, 0, 640, 480); c.clip();
  c.globalAlpha = Math.min(1, remaining / 12);
  c.fillStyle = '#080805'; c.fillRect(0, 0, 640, 480);
  c.translate(shake - leave * 90, 0);

  // 斜めの金の裂け目から人物を見せる。文字と絵は画像へ焼き込まない。
  c.save();
  c.beginPath();
  c.moveTo(640 - 720 * reveal, 22); c.lineTo(820, 22);
  c.lineTo(820, 458); c.lineTo(720 - 720 * reveal, 458); c.closePath(); c.clip();
  const light = c.createLinearGradient(120, 430, 580, 30);
  light.addColorStop(0, '#16100a'); light.addColorStop(0.55, '#9b6c1d'); light.addColorStop(1, '#292014');
  c.fillStyle = light; c.fillRect(0, 22, 820, 436);
  for (let i = 0; i < 19; i++) {
    const y = 28 + (i * 47) % 424;
    const x = (i * 139 - age * (9 + i % 4) + 4000) % 1000 - 180;
    c.strokeStyle = i % 3 ? '#f6ce654a' : '#fff2b9aa'; c.lineWidth = i % 4 === 0 ? 2 : 0.7;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + 160, y - 38); c.stroke();
  }
  if (image?.complete && image.naturalWidth > 0) {
    const scale = Math.max(640 / image.naturalWidth, 480 / image.naturalHeight) * (1.08 - clamp((age - 28) / 110) * 0.08);
    const w = image.naturalWidth * scale; const h = image.naturalHeight * scale;
    c.drawImage(image, (640 - w) / 2 + (1 - reveal) * 110, (480 - h) / 2, w, h);
  }
  c.restore();

  // 二拍の宣言は左上へ残し、顔と技名を別の領域に置く。
  const settle = easeOut((age - 28) / 18);
  c.save(); c.rotate(-0.07);
  glyph(c, '奥', age, 160 - settle * 78, 140 - settle * 30, 118 - settle * 42, '#f5d994');
  glyph(c, '義', age - ULTIMATE_SECOND_STAMP, 258 - settle * 132, 263 - settle * 60, 118 - settle * 42, '#f5d994');
  c.restore();

  if (age >= ULTIMATE_TITLE - 5) {
    const open = easeOut((age - ULTIMATE_TITLE + 5) / 12);
    c.save(); c.globalAlpha *= open;
    c.fillStyle = '#080805e8';
    c.beginPath(); c.moveTo(0, 340); c.lineTo(800, 292); c.lineTo(800, 437); c.lineTo(0, 470); c.closePath(); c.fill();
    c.strokeStyle = '#d5a946'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, 340); c.lineTo(800, 292); c.moveTo(0, 470); c.lineTo(800, 437); c.stroke();
    c.restore();
    for (const [index, letter] of [...'迅雷一閃'].entries()) {
      glyph(c, letter, age - ULTIMATE_TITLE - index * 7, 150 + index * 113, 388 - index * 5, 94, '#fff4d3');
    }
  }

  // 最後の一閃で切り払い、攻撃前の稲妻オーラへ戻す。
  if (age >= 126) {
    const slash = clamp((age - 126) / 10);
    c.strokeStyle = '#fff8d8'; c.lineWidth = (1 - slash) * 18;
    c.globalAlpha *= 1 - slash;
    c.beginPath(); c.moveTo(-100, 440); c.lineTo(-100 + slash * 1000, 440 - slash * 390); c.stroke();
  }
  c.restore();
}
