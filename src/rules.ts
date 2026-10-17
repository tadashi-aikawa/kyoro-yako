export type PlayerId = 'mimiko';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'lunatic';
export type ItemKind = 'small' | 'large' | 'point' | 'bomb' | 'life';

export const FIELD = { x: 32, y: 16, w: 384, h: 448 } as const;
export const DIFFICULTY: Record<Difficulty, number> = { easy: 0.6, normal: 1, hard: 1.4, lunatic: 1.8 };
export const EXTENDS = [10_000_000, 20_000_000, 40_000_000, 60_000_000];
export const MAX_BOMBS = 8;

export function circlesHit(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy <= (ar + br) ** 2;
}

export function bulletContact(px: number, py: number, bx: number, by: number, radius: number, grazed: boolean): 'hit' | 'graze' | 'none' {
  if (circlesHit(px, py, 2.5, bx, by, radius)) return 'hit';
  if (!grazed && circlesHit(px, py, 18, bx, by, radius)) return 'graze';
  return 'none';
}

export function deathbomb(framesSinceHit: number, bombs: number): boolean {
  return framesSinceHit >= 0 && framesSinceHit < 8 && bombs > 0;
}

export function autoCollect(playerY: number): boolean {
  return playerY < 112;
}

export function pointValue(y: number, maxValue: number): number {
  if (y < 112) return maxValue;
  const descent = (Math.min(y, 448) - 111) / 337;
  return Math.max(1000, Math.floor((maxValue * (1 - 0.75 * descent)) / 100) * 100);
}

export function newExtends(before: number, after: number): number {
  return EXTENDS.filter((threshold) => before < threshold && after >= threshold).length;
}

export function density(difficulty: Difficulty, normalCount: number): number {
  return Math.max(1, Math.round(normalCount * DIFFICULTY[difficulty]));
}

export function bulletSpeed(difficulty: Difficulty, normalSpeed: number): number {
  return normalSpeed * (0.9 + (DIFFICULTY[difficulty] - 1) * 0.18);
}

export function safeLoad<T>(key: string, fallback: T, parse: (raw: string) => T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : parse(raw);
  } catch {
    return fallback;
  }
}

export function safeSave(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* storage can be disabled */ }
}
