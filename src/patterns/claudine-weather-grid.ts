import type { Game } from '../game';

export const RAIN_GLYPHS = ['A', 'a', 'B', 'g', 'Ω', 'π', 'あ', '永', '&', '¶', '@', '※'] as const;
export const RAIN_FONTS = ['bold 18px serif', 'italic bold 18px sans-serif', 'bold 18px monospace'] as const;
export const WEATHER_NAMES = ['小雨', '豪雨', '台風'] as const;
export const WEATHER_PERIOD = 240;
export const GRID_PERIOD = [210, 180, 160, 145] as const;
export const GRID_NAMES = ['均等列', '可変幅', '可変行', '千鳥配置'] as const;
export const GRID_COLUMNS = [12, 8, 11, 10] as const;
export const GRID_ROWS = [4, 5, 6, 7] as const;
export const GRID_DIRECTIONS = ['↓', '→', '↑', '←'] as const;
export const gridRows = (level: number): number => GRID_ROWS[level];
export const gridVelocity = (layout: number, level: number): [number, number] => {
  const speed = [1.25, 1.6, 1.95, 2.25][level];
  return [[0, speed], [speed, 0], [0, -speed], [-speed, 0]][layout] as [number, number];
};
export const weatherAt = (t: number): number => Math.floor(Math.max(0, t) / WEATHER_PERIOD) % 3;
export const gridLayoutAt = (t: number, level: number): number => Math.floor(Math.max(0, t) / GRID_PERIOD[level]) % 4;

export function gridPoint(layout: number, row: number, column: number, level = 1): [number, number] {
  const x = layout === 1 ? 8 + [0, 0.07, 0.2, 0.31, 0.5, 0.58, 0.8, 1][column] * 368
    : Math.min(376, 8 + column * 368 / (GRID_COLUMNS[layout] - 1) + (layout === 3 && row % 2 ? 14 : 0));
  const fraction = row / (gridRows(level) - 1);
  const y = 54 + (layout === 2 ? fraction ** 0.8 : fraction) * 344;
  return [x, y + (layout === 1 ? column % 2 * 10 : 0)];
}

export function emitTypographyRain(game: Game, t: number): void {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const weatherPeriod = WEATHER_PERIOD;
  const weather = weatherAt(t);
  if (t % weatherPeriod === 0) game.audio.play(weather === 2 ? 'wind' : 'turn');
  const period = [[20, 14, 12, 10], [8, 5, 4, 3], [6, 4, 3, 3]][weather][level];
  if (t % period !== 0) return;
  const n = [[2, 3, 4, 5], [3, 4, 5, 6], [4, 5, 6, 7]][weather][level];
  const wave = Math.floor(t / period);
  const direction = Math.floor(t / (weatherPeriod * 3)) % 2 ? -1 : 1;
  for (let i = 0; i < n + (weather === 2 ? 1 : 0); i++) {
    const size = (wave + i) % 3;
    const fromSide = i === n;
    const x = fromSide ? direction > 0 ? -8 : 392 : 8 + (wave * 37 + i * 79) % 368;
    const y = fromSide ? -8 + (wave * 53) % 420 : -12 - i * 3;
    const speed = [1.35, 2.65, 2.2][weather] + level * 0.2 + size * 0.23;
    const drift = weather === 2 ? direction * 1.25 : weather === 1 ? Math.sin(t * 0.01) * 0.3 : 0;
    const b = game.spawnBullet(x, y, drift, speed, (wave + i) % 4, 'glyph');
    if (!b) continue;
    b.motion = 'typographyRain'; b.radius = 2.4 + size * 0.6;
    b.gridColumn = (wave + i * 5) % RAIN_GLYPHS.length; b.gridRow = (wave + i) % RAIN_FONTS.length;
    b.targetX = drift; b.sway = weather === 2 ? 1.4 : 0.08;
    b.swayRate = 0.025; b.swayPhase = wave * 0.13 + i;
    b.spin = weather === 2 ? direction * 0.006 : 0; b.rotation = weather === 2 ? direction * 0.2 : 0;
  }
}

export function emitChangingGrid(game: Game, t: number): void {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const period = GRID_PERIOD[level];
  if (t % period !== 0) return;
  const wave = Math.floor(t / period);
  const layout = wave % 4;
  const [x, y] = game.bossPosition();
  game.audio.play('turn'); game.spark(x, y, '#fff2d1', 14);
  const [vx, vy] = gridVelocity(layout, level);
  for (let row = 0; row < gridRows(level); row++) for (let col = 0; col < GRID_COLUMNS[layout]; col++) {
    const [tx, ty] = gridPoint(layout, row, col, level);
    const b = game.spawnBullet(tx, ty, 0, 0, (row + layout) % 4, 'orb');
    if (!b) continue;
    b.motion = 'layoutGrid'; b.targetX = tx; b.targetY = ty; b.gridColumn = col; b.gridRow = row;
    b.delay = [90, 70, 55, 42][level];
    b.releaseAt = b.delay + 1; b.sway = vx; b.swayRate = vy;
    b.radius = 3.5;
  }
}
