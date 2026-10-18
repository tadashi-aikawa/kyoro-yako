import type { Bullet, Game } from '../game';
import { bulletSpeed, DIFFICULTY, density } from '../rules';

export function normalPeriod(game: Game, frames: number): number {
  return Math.round(frames / Math.sqrt(DIFFICULTY[game.difficulty]));
}

// 通常攻撃は直線運動だけ。1斉射の弾間を保ち、発射のテンポで密度を増やす。
export function emitBossNormal(game: Game, pattern: string, t: number, origin = game.bossPosition()): void {
  const [x, y] = origin;
  const count = (base: number, maximum: number) => Math.min(maximum, density(game.difficulty, base));
  const speed = (base: number) => bulletSpeed(game.difficulty, base);
  const period = (frames: number) => normalPeriod(game, frames);
  const shot = (cx: number, cy: number, vx: number, vy: number, color: number, kind: Bullet['kind']) => {
    const b = game.spawnBullet(cx, cy, vx, vy, color, kind);
    if (b) b.radius = kind === 'needle' ? 2.4 : 3;
  };
  const fan = (n: number, width: number, velocity: number, color: number, kind: Bullet['kind'], aim = Math.atan2(game.py - y, game.px - x)) => {
    for (let i = 0; i < n; i++) {
      const a = aim + (i / (n - 1) - 0.5) * width;
      shot(x, y, Math.cos(a) * velocity, Math.sin(a) * velocity, color, kind);
    }
  };
  const ring = (base: number, maximum: number, velocity: number, color: number, kind: Bullet['kind'], offset: number) => {
    const n = Math.min(maximum, Math.max(4, Math.round(density(game.difficulty, base) / 2) * 2));
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * Math.PI * 2 / n + offset;
      shot(x, y, Math.cos(a) * velocity, Math.sin(a) * velocity, color, kind);
    }
  };

  if (pattern === 'neoTripleTap' || pattern === 'neoSyncopation') {
    const syncopation = pattern === 'neoSyncopation';
    const beat = period(syncopation ? 104 : 106);
    const step = t % beat;
    const tap = syncopation ? 10 : 8;
    if (step === 0 || step === tap || step === tap * 2) {
      const n = count(3, 5);
      fan(n, (n - 1) * 0.19, speed(1.6), 1, 'needle');
    }
    if (Math.floor(t / beat) % 2 === 0 && (step === 42 || step === 56)) {
      const n = count(12, 15);
      for (let i = 0; i < n; i++) {
        const bx = 8 + i * 368 / (n - 1) + (step === 56 ? Math.sin(i * Math.PI / (n - 1)) * 10 : 0);
        shot(bx, -8, syncopation ? Math.sin(t * 0.015) * 0.18 : 0, speed(1.6), 2, 'star');
      }
    }
    return;
  }

  if (pattern === 'obsidiaShelves' || pattern === 'obsidiaIndex') {
    const index = pattern === 'obsidiaIndex';
    const beat = period(index ? 60 : 30);
    const step = t % beat;
    if (step !== 0 && !(index && step === Math.round(beat / 3))) return;
    const row = Math.floor(t / beat) * (index ? 2 : 1) + Number(step > 0);
    const n = count(14, 15);
    for (let i = 0; i < n; i++) {
      shot(8 + i * 368 / (n - 1), -8, speed(row % 2 ? -0.4 : 0.4), speed(1.6), row % 2 ? 2 : 0, 'glyph');
    }
    return;
  }

  if (pattern === 'claudinePetalArc' || pattern === 'claudineQuietRings') {
    const rings = pattern === 'claudineQuietRings';
    const beat = period(rings ? 64 : 52);
    if (t % beat !== 0) return;
    const wave = Math.floor(t / beat);
    const color = wave % 2 ? 1 : 3;
    if (rings) ring(52, 70, speed(wave % 2 ? 1.7 : 1.6), color, 'orb', 0);
    else fan(count(30, 34), Math.PI * 0.96, speed(1.65), color, 'petal', Math.PI / 2);
    return;
  }

  if (pattern === 'jinraiRapidFan' || pattern === 'jinraiRapidRings') {
    const reverseRings = pattern === 'jinraiRapidRings';
    const beat = period(reverseRings ? 96 : 84);
    const step = t % beat;
    const wave = Math.floor(t / beat);
    const volley = [0, 0.2, 0.4, 0.6].findIndex((fraction) => step === Math.round(beat * fraction));
    if (volley >= 0) ring(reverseRings ? 16 : 14, 64, speed(5.1), (wave + volley) % 2 ? 1 : 2, 'needle', wave * 0.07 + volley * (reverseRings ? -0.08 : 0.08));
    // 高速の自機狙いは1周期1回だけ。ばらまきと同じボス位置から撃つ。
    if (step === Math.round(beat * 0.8)) fan(count(7, 11), Math.PI / 3, speed(5.1), 1, 'needle');
    return;
  }

  if (pattern === 'minervaStarFan' || pattern === 'minervaStarRings') {
    const layered = pattern === 'minervaStarRings';
    // Easyの通過量上限とNormalの最多密度を両立するため、最終面だけ周期を比例で伸縮する。
    const beat = Math.round((layered ? 88 : 84) / DIFFICULTY[game.difficulty]);
    const step = t % beat;
    const wave = Math.floor(t / beat);
    if (step === 0) fan(count(25, 25), Math.PI * 2 / 3, speed(1.65), wave % 2 ? 1 : 2, 'star');
    if (step === Math.round(beat / 2)) ring(layered ? 60 : 56, 70, speed(1.65), wave % 2 ? 2 : 1, 'star', layered ? wave * 0.04 : 0);
  }
}
