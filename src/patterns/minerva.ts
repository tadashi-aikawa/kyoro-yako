import type { Bullet, Game } from '../game';
import { circlesHit, DIFFICULTY, density } from '../rules';

export const MINERVA_WARNING = [90, 70, 55, 42] as const;
export const HYPOTHESIS_PERIOD = [210, 185, 165, 145] as const;
export const EYE_PERIOD = 240;
export const HYPOTHESIS_COLUMNS = [7, 10, 12, 14] as const;
export const HYPOTHESIS_SPEED = [1.7, 2.1, 2.45, 2.8] as const;
export const DAWN_PERIOD = [60, 48, 40, 34] as const;
export const PRAYER_PERIOD = 360;
export const PRAYER_CHARGE = 72;
export const PRAYER_FIRE = 180;
export const INTERVIEW_PERIOD = [330, 300, 270, 240] as const;
export const INTERVIEW_SPEED = [1.5, 1.8, 2.1, 2.4] as const;
export const INTERVIEW_SPIN = [0.001, 0.0012, 0.0014, 0.0016] as const;
const INTERVIEW_GAP = [0.62, 0.54, 0.46, 0.4] as const;
const INTERVIEW_STOPS = [[192, 132], [272, 104], [136, 182], [256, 164], [112, 102], [218, 82]] as const;

export function interviewPosition(frame: number, level: number): [number, number] {
  const t = Math.max(0, frame - 105);
  const period = INTERVIEW_PERIOD[level];
  const wave = Math.floor(t / period);
  const from = INTERVIEW_STOPS[wave % INTERVIEW_STOPS.length];
  const to = INTERVIEW_STOPS[(wave + 1) % INTERVIEW_STOPS.length];
  // 発射の前後だけ一拍止まり、次の発射までに自機と無関係な観測点へ移る。
  const progress = Math.max(0, Math.min(1, (t % period - 18) / (period - 36)));
  const ease = progress * progress * (3 - 2 * progress);
  return [from[0] + (to[0] - from[0]) * ease, from[1] + (to[1] - from[1]) * ease];
}
export function dawnPrayerStep(frame: number): number { return frame < 1800 ? -1 : (frame - 1800) % PRAYER_PERIOD; }
export function dawnPosition(frame: number): [number, number] {
  const usual: [number, number] = [192 + Math.sin(frame * 0.012) * 42, 132 + Math.sin(frame * 0.018) * 4];
  const step = dawnPrayerStep(frame);
  if (step < 0) return usual;
  const start = frame - step;
  const fixed: [number, number] = [192 + Math.sin(start * 0.012) * 42, 132 + Math.sin(start * 0.018) * 4];
  if (step < PRAYER_CHARGE + PRAYER_FIRE) return fixed;
  const progress = (step - PRAYER_CHARGE - PRAYER_FIRE) / (PRAYER_PERIOD - PRAYER_CHARGE - PRAYER_FIRE);
  const ease = progress * progress * (3 - 2 * progress);
  return [fixed[0] + (usual[0] - fixed[0]) * ease, fixed[1] + (usual[1] - fixed[1]) * ease];
}
export function hypothesisX(side: number, column: number, level: number, wave: number): number {
  // 境界を波ごとにずらす。固定の中央通路に居続けるだけで避けられる状態を作らない。
  const boundary = 192 + Math.sin(wave * 1.17) * 54;
  const from = side === 0 ? 8 : boundary + 4;
  const to = side === 0 ? boundary - 4 : 376;
  return from + column * (to - from) / (HYPOTHESIS_COLUMNS[level] - 1);
}
export function dawnLane(wave: number): number { return 76 + wave % 6 * 48; }
export function eyeX(t: number): number {
  const step = ((t % EYE_PERIOD) + EYE_PERIOD) % EYE_PERIOD;
  return step < 120 ? 32 + step * 320 / 120 : 352 - (step - 120) * 320 / 120;
}
export function hypothesisSide(wave: number): number { return wave % 2; }
export function hypothesisBrightness(level: number, real: boolean, frame: number): number {
  return real
    ? [0.66, 0.53, 0.44, 0.39][level] + [0.22, 0.16, 0.11, 0.07][level] * (0.5 + 0.5 * Math.sin(frame * 0.18))
    : 0.36;
}

export function updateDawnOwls(game: Game): void {
  if (game.phase?.pattern !== 'owlDawn') return;
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const count = game.phaseFrame >= 2700 ? 2 : game.phaseFrame >= 1800 ? 1 : 0;
  while (game.dawnOwls.length < count) {
    const x = game.dawnOwls.length === 0 ? 36 : 348;
    game.dawnOwls.push({ x, y: 100, targetX: 192, targetY: 320, age: 0, warning: MINERVA_WARNING[level], color: 2 });
    game.audio.play('wind');
  }
  for (const owl of game.dawnOwls) {
    owl.age++;
    if (owl.age <= owl.warning) continue;
    let dx = owl.targetX - owl.x;
    let dy = owl.targetY - owl.y;
    let distance = Math.hypot(dx, dy);
    if (distance < 4) {
      // 画面内のランダムな目的地へ直線飛行。出現時の予告以外は瞬間移動しない。
      owl.targetX = 28 + Math.random() * 328;
      owl.targetY = owl.y > 224 ? 60 + Math.random() * 148 : 248 + Math.random() * 164;
      dx = owl.targetX - owl.x; dy = owl.targetY - owl.y; distance = Math.hypot(dx, dy);
    }
    const speed = [1.15, 1.5, 1.8, 2.1][level];
    owl.x += dx / distance * Math.min(speed, distance);
    owl.y += dy / distance * Math.min(speed, distance);
    if (game.invulnFrames <= 0 && !game.invincible && game.pendingHit < 0 && circlesHit(game.px, game.py, 2.5, owl.x, owl.y, 11)) {
      game.pendingHit = 0; game.hitDuringSpell = true;
    }
  }
}

export function emitMinerva(game: Game, pattern: string): void {
  const t = game.phaseFrame - 105;
  const [x, y] = game.bossPosition();
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const unit = 0.9 + (DIFFICULTY[game.difficulty] - 1) * 0.18;
  const count = (n: number) => density(game.difficulty, n);
  const interval = (n: number) => Math.max(4, Math.round(n / DIFFICULTY[game.difficulty]));
  const warning = MINERVA_WARNING[level];
  const ring = (cx: number, cy: number, n: number, speed: number, color: number, offset = 0, gap = -1, kind: Bullet['kind'] = 'orb') => {
    for (let i = 0; i < n; i++) {
      if (gap >= 0 && (i - gap + n) % n < 2) continue;
      const angle = offset + i * Math.PI * 2 / n;
      game.spawnBullet(cx, cy, Math.cos(angle) * speed, Math.sin(angle) * speed, color, kind);
    }
  };
  if (pattern === 'sevenRings' && t % interval(330) === 0) {
    for (let layer = 0; layer < 7; layer++) {
      const radius = 76 + layer * 18;
      const n = count(20 + layer * 2);
      const direction = layer % 2 ? -1 : 1;
      const gap = (Math.floor(t / interval(330)) * 3 + layer * 4) % n;
      for (let i = 0; i < n; i++) {
        if ((i - gap + n) % n < 2) continue;
        const angle = i * Math.PI * 2 / n + layer * 0.14;
        const b = game.spawnBullet(192 + Math.cos(angle) * radius, 220 + Math.sin(angle) * radius,
          -Math.cos(angle) * 0.45 * unit - Math.sin(angle) * direction * 0.17 * unit,
          -Math.sin(angle) * 0.45 * unit + Math.cos(angle) * direction * 0.17 * unit, layer % 4, 'orb');
        if (b) { b.motion = 'minervaRing'; b.delay = warning; b.spin = direction * 0.003;
          b.releaseAt = warning + [120, 96, 80, 64][level]; b.swayPhase = angle; }
      }
    }
  }
  if (pattern === 'question' && t % interval(135) === 0) {
    const shape = [[-36, -25], [-26, -42], [-8, -49], [13, -47], [32, -33], [38, -14], [30, 2], [12, 14], [0, 29], [0, 49], [0, 78]];
    for (const centerX of (level === 0 ? [125, 255] : [82, 192, 302])) for (const [dx, dy] of shape) {
      const tx = centerX + dx;
      const ty = 200 + dy;
      const b = game.spawnBullet(x, y, (tx - x) / 40, (ty - y) / 40, 1, 'star');
      if (b) { b.motion = 'question'; b.targetX = tx; b.targetY = ty; b.releaseAt = [101, 76, 66, 58][level]; }
    }
    ring(x, y, count(34), 1.35 * unit, 2, t * 0.012, 0);
  }
  if (pattern === 'hypothesis') {
    const period = HYPOTHESIS_PERIOD[level];
    const wave = Math.floor(t / period);
    const local = t % period - warning;
    if (local >= 0 && local <= (level === 0 ? 18 : 36) && local % 18 === 0) {
      if (local === 0) game.audio.play('turn');
      const side = hypothesisSide(wave);
      const n = HYPOTHESIS_COLUMNS[level];
      for (let i = 0; i < n; i++) {
        const bx = hypothesisX(side, i, level, wave);
        const b = game.spawnBullet(bx, 24, 0, HYPOTHESIS_SPEED[level], side === 0 ? 1 : 3, 'star');
        if (b) b.radius = 3.5;
      }
    }
  }
  if (pattern === 'owlEye' && t % [42, 32, 26, 22][level] === 0) {
    const n = [8, 12, 15, 18][level];
    const row = Math.floor(t / [42, 32, 26, 22][level]);
    for (let i = 0; i < n; i++) {
      if (i === row % n) continue;
      const stagger = i > 0 && i < n - 1 ? Math.sin(row * 1.1) * 368 / (n - 1) * 0.4 : 0;
      const b = game.spawnBullet(8 + i * 368 / (n - 1) + stagger, 36, 0, [1.15, 1.5, 1.8, 2.1][level], i % 2 ? 1 : 2, 'orb');
      if (b) { b.motion = 'eyeFreeze'; b.delay = warning; b.radius = 4; }
    }
  }
  if (pattern === 'recall' && t % interval(150) === 0) {
    const n = count(54);
    for (let i = 0; i < n; i++) {
      const angle = i * Math.PI * 2 / n + t * 0.01;
      const b = game.spawnBullet(x, y, Math.cos(angle) * 1.35 * unit, Math.sin(angle) * 1.35 * unit, i % 4, 'orb');
      if (b) { b.motion = 'recall'; b.targetX = x; b.targetY = y; b.releaseAt = [126, 105, 95, 87][level]; b.gridRow = [84, 66, 56, 48][level]; }
    }
  }
  if (pattern === 'citation' && t % [145, 112, 92, 78][level] === 0) {
    const n = [6, 9, 12, 15][level];
    for (let i = 0; i < n; i++) {
      const b = game.spawnBullet(18 + (i + 0.5) * 348 / n, 46, 0, [0.9, 1.15, 1.4, 1.65][level], 2, 'star');
      if (b) { b.motion = 'citation'; b.gridRow = 0; b.releaseAt = warning; b.radius = 6; }
    }
  }
  if (pattern === 'interview' && t % INTERVIEW_PERIOD[level] === 0) {
    const wave = Math.floor(t / INTERVIEW_PERIOD[level]);
    // 下側の画面内へ穴を向ける。輪ごとに左右を変え、下端での撃ち続けを通さない。
    const gap = Math.atan2(420 - y, 192 + Math.sin(wave * 1.05 + 0.6) * 135 - x);
    // 数百発を重ねず、描画・更新・当たり判定を輪1本で扱う。
    // 回転の接線速度も低速移動より遅くし、穴を追える余裕を残す。
    game.interviewRings.push({ x, y, radius: 45, speed: INTERVIEW_SPEED[level], gap,
      opening: INTERVIEW_GAP[level], spin: (wave % 2 ? -1 : 1) * INTERVIEW_SPIN[level], color: wave % 4, delay: warning, launched: false, grazed: false });
  }
  if (pattern === 'owlDawn') {
    // 残り45秒から、背後の上半面へ継続的に撃つ。上端での待機を許さない。
    const rearTime = game.phaseFrame - 900;
    if (rearTime >= 0 && rearTime % [26, 20, 16, 14][level] === 0) {
      const n = [15, 21, 27, 33][level];
      const sweep = Math.sin(rearTime * 0.035) * 0.08;
      for (let i = 0; i < n; i++) {
        const angle = Math.PI + i * Math.PI / (n - 1) + sweep;
        const speed = [1.3, 1.45, 1.6, 1.75][level];
        const b = game.spawnBullet(x, y - 18, Math.cos(angle) * speed, Math.sin(angle) * speed, 2, 'needle');
        if (b) b.radius = 2.8;
      }
    }
    // 祈って一拍溜め、3秒だけ高速の渦を連射する。休止を挟んで6秒周期で繰り返す。
    const prayer = dawnPrayerStep(game.phaseFrame);
    if (prayer === 0) game.audio.play('prayerCharge');
    const fireTime = prayer - PRAYER_CHARGE;
    if (fireTime >= 0 && fireTime < PRAYER_FIRE && fireTime % [4, 3, 2, 2][level] === 0) {
      if (fireTime === 0) game.audio.play('laser');
      if (fireTime % 12 === 0) game.audio.play('split');
      const arms = [5, 7, 9, 11][level];
      const direction = Math.floor((game.phaseFrame - 1800) / PRAYER_PERIOD) % 2 ? -1 : 1;
      const rotation = direction * fireTime * 0.027;
      for (let i = 0; i < arms; i++) {
        const angle = Math.PI / 2 + rotation + i * Math.PI * 2 / arms;
        const speed = [2.6, 3.0, 3.6, 4.2][level];
        const b = game.spawnBullet(x + Math.cos(angle) * 22, y + Math.sin(angle) * 22, Math.cos(angle) * speed, Math.sin(angle) * speed, i % 2 ? 1 : 2, 'orb');
        if (b) b.radius = 2.3;
      }
    }
  }
  if (pattern === 'owlDawn' && t % DAWN_PERIOD[level] === 0) {
    const period = DAWN_PERIOD[level];
    const side = Math.floor(t / period) % 2 ? -1 : 1;
    const cx = side > 0 ? -8 : 392;
    // 下端付近も編隊が通る。前の3レーンだけでは下端に留まるだけで避けられた。
    const cy = dawnLane(Math.floor(t / period));
    for (const wing of [-1, 1]) for (let i = 0; i < count(17); i++) {
      const b = game.spawnBullet(cx + wing * i * 5, cy + i * 2.8 + Math.sin(i * 0.5) * 8, side * 2.25 * unit, 0.42 * unit, i % 4, i % 3 ? 'petal' : 'star');
      if (b) b.motion = 'wing';
    }
    for (let i = -2; i <= 2; i++) game.spawnBullet(cx, cy + i * 5, side * 2.25 * unit, 0.42 * unit, 2, 'star');
    if (t % (period * 3) === 0) game.audio.play('wind');
  }
}
