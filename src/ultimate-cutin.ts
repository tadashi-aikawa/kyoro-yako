// 戦闘時計から演出の実時間を分離し、読むための静止と短い退場を入れる。
export const ULTIMATE_CUTIN_FRAMES = 150;
export const ULTIMATE_SECOND_STAMP = 12;
export const ULTIMATE_TITLE = 64;
export const ULTIMATE_HOLD = 72;

export const ULTIMATE_CUTINS = {
  jinrai: { id: 'jinrai-issen', pattern: 'jinraiDash', declaration: '奥義', title: '迅雷一閃', duration: 150, fadeFrames: 24, ink: '#f5d994', light: '#9b6c1d', dark: '#16100a', end: '#292014', streak: '#f6ce65', brightStreak: '#fff2b9', edge: '#d5a946' },
  claudine: { id: 'claudine-bloom', pattern: 'final', declaration: '絢爛', title: 'レスポンシブ・ブルーム', duration: 100, fadeFrames: 19, ink: '#f1d4be', light: '#92556c', dark: '#20121d', end: '#20121d', streak: '#f1d4be', brightStreak: '#f1d4be', edge: '#efb3bc' },
  minerva: { id: 'minerva-oracle', pattern: 'owlDawn', declaration: '神託', title: 'オウル・オブ・ミネルヴァ', duration: 100, fadeFrames: 19, ink: '#ffe4ab', light: '#9c8a50', dark: '#191a32', end: '#191a32', streak: '#ffe4ab', brightStreak: '#ffe4ab', edge: '#e6cf84' },
} as const;
export type UltimateCutin = typeof ULTIMATE_CUTINS[keyof typeof ULTIMATE_CUTINS];
export function ultimateCutin(boss: string | undefined, pattern: string | undefined): UltimateCutin | undefined {
  const spec = ULTIMATE_CUTINS[boss as keyof typeof ULTIMATE_CUTINS];
  return spec?.pattern === pattern ? spec : undefined;
}
export function ultimateCueFrame(spec: UltimateCutin, frame: number): number { return Math.round(frame * spec.duration / ULTIMATE_CUTIN_FRAMES); }
export function ultimateDuration(spec: UltimateCutin): number { return ultimateCueFrame(spec, 120) + ULTIMATE_HOLD + spec.fadeFrames; }
export function ultimateTimeline(spec: UltimateCutin, frame: number): { age: number; battleFrame: number } {
  const hold = ultimateCueFrame(spec, 96), fade = ultimateCueFrame(spec, 120);
  const total = ultimateDuration(spec);
  let progress = frame;
  if (frame >= hold) progress = frame <= hold + ULTIMATE_HOLD ? hold : frame - ULTIMATE_HOLD;
  if (frame >= fade + ULTIMATE_HOLD) progress = fade + (frame - fade - ULTIMATE_HOLD) * (spec.duration - fade) / spec.fadeFrames;
  if (frame >= total) progress = spec.duration;
  progress = Math.max(0, Math.min(spec.duration, progress));
  return { age: progress * ULTIMATE_CUTIN_FRAMES / spec.duration, battleFrame: Math.floor(progress + 1e-6) };
}

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

export function drawUltimateCutin(c: CanvasRenderingContext2D, image: HTMLImageElement | undefined, remaining: number, spec: UltimateCutin, presentationFrame = -1): void {
  const age = presentationFrame >= 0 ? ultimateTimeline(spec, presentationFrame).age : (spec.duration - remaining) * ULTIMATE_CUTIN_FRAMES / spec.duration;
  const motion = presentationFrame >= 0 ? presentationFrame * ULTIMATE_CUTIN_FRAMES / spec.duration : age;
  const reveal = easeOut((age - 28) / 22);
  const exit = clamp((age - 120) / 30);
  const leave = exit * exit * (3 - 2 * exit);
  const secondStamp = ULTIMATE_SECOND_STAMP * ULTIMATE_CUTIN_FRAMES / spec.duration;
  const stamp = age >= secondStamp ? age - secondStamp : age;
  const shake = Math.max(0, 5 - stamp) * Math.sin(age * 2.7);
  c.save();
  c.beginPath(); c.rect(0, 0, 640, 480); c.clip();
  c.globalAlpha = 1 - leave;
  c.fillStyle = '#080805'; c.fillRect(0, 0, 640, 480);
  c.translate(shake - leave * 36, 0);

  // 斜めの裂け目から人物を見せる。文字と絵は画像へ焼き込まない。
  c.save();
  c.beginPath();
  c.moveTo(640 - 720 * reveal, 22); c.lineTo(820, 22);
  c.lineTo(820, 458); c.lineTo(720 - 720 * reveal, 458); c.closePath(); c.clip();
  const light = c.createLinearGradient(120, 430, 580, 30);
  light.addColorStop(0, spec.dark); light.addColorStop(0.55, spec.light); light.addColorStop(1, spec.end);
  c.fillStyle = light; c.fillRect(0, 22, 820, 436);
  for (let i = 0; i < 19; i++) {
    const y = 28 + (i * 47) % 424;
    const x = ((i * 139 - motion * (9 + i % 4)) % 1000 + 1000) % 1000 - 180;
    c.strokeStyle = i % 3 ? `${spec.streak}4a` : `${spec.brightStreak}aa`; c.lineWidth = i % 4 === 0 ? 2 : 0.7;
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
  const owl = spec.pattern === 'owlDawn';
  glyph(c, spec.declaration[0], age, 160 - settle * 78, 140 + settle * (owl ? 68 : -30), 118 - settle * 42, spec.ink);
  glyph(c, spec.declaration[1], age - secondStamp, 258 - settle * 132, 263 + settle * (owl ? 31 : -60), 118 - settle * 42, spec.ink);
  c.restore();

  if (age >= ULTIMATE_TITLE - 5) {
    const open = easeOut((age - ULTIMATE_TITLE + 5) / 12);
    c.save(); c.globalAlpha *= open;
    c.fillStyle = '#080805e8';
    c.beginPath(); c.moveTo(0, 340); c.lineTo(800, 292); c.lineTo(800, 437); c.lineTo(0, 470); c.closePath(); c.fill();
    c.strokeStyle = spec.edge; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, 340); c.lineTo(800, 292); c.moveTo(0, 470); c.lineTo(800, 437); c.stroke();
    c.restore();
    const titleAge = age - ULTIMATE_TITLE;
    if (titleAge >= 0) {
      const sweep = clamp(titleAge / 9);
      const letters = [...spec.title], size = Math.min(94, 530 / letters.length);
      const gap = Math.min(113, 530 / letters.length);
      // 拡大して跳ねさせず、斜めの閃光で技名を一気に切り開く。
      c.save();
      c.beginPath(); c.rect(0, 292, 640 * sweep, 178); c.clip();
      c.translate(-(1 - easeOut(titleAge / 9)) * 28, 0);
      for (const [index, letter] of letters.entries()) {
        glyph(c, letter, 8, 320 + (index - (letters.length - 1) / 2) * gap, 388 - index * Math.min(5, 40 / (letters.length - 1)), size, '#fff4d3');
      }
      c.restore();
      if (titleAge < 18) {
        const gleam = 1 - clamp((titleAge - 8) / 10);
        c.save(); c.globalAlpha *= gleam;
        c.strokeStyle = '#fff8e5'; c.shadowColor = spec.ink; c.shadowBlur = 14;
        c.lineWidth = 2 + gleam * 3;
        c.beginPath(); c.moveTo(-30, 417); c.lineTo(-30 + 740 * sweep, 417 - 64 * sweep); c.stroke();
        const tip = -30 + 740 * sweep, y = 417 - 64 * sweep;
        c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(tip - 32, y); c.lineTo(tip + 32, y);
        c.moveTo(tip, y - 21); c.lineTo(tip, y + 21); c.stroke();
        c.restore();
      }
    }
  }

  // 光で切り払い、各ボスの構えへ戻す。
  if (age >= 126) {
    const slash = clamp((age - 126) / 10);
    c.strokeStyle = '#fff8d8'; c.lineWidth = (1 - slash) * 18;
    c.globalAlpha *= 1 - slash;
    c.beginPath(); c.moveTo(-100, 440); c.lineTo(-100 + slash * 1000, 440 - slash * 390); c.stroke();
  }
  c.restore();
}
