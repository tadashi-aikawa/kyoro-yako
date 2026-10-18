import type { Bullet, Game } from '../game';

export const CHAPPY_THROW = 38;
export const CHAPPY_PORTS = [[96, 148], [288, 148]] as const;
export const CODEX_PERIOD = [300, 270, 240, 210] as const;
export const CODEX_WARNING = [96, 78, 66, 54] as const;
export const PARALLEL_BEAT = [108, 90, 78, 66] as const;
export const DELIVERY_PERIOD = [290, 260, 230, 210] as const;

function source(game: Game, motion: 'codexBox' | 'chappyBloom', x: number, y: number, warning: number): Bullet | undefined {
  const [bx, by] = game.bossPosition();
  const b = game.spawnBullet(bx, by, (x - bx) / CHAPPY_THROW, (y - by) / CHAPPY_THROW, 1, 'star');
  // 発射源そのものは無害。ボムやフェーズ終了では通常の弾と一緒に消え、後続射撃も中止する。
  if (b) { b.motion = motion; b.delay = 1; b.radius = 0; b.targetX = x; b.targetY = y; b.releaseAt = warning; }
  return b;
}

function star(game: Game, x: number, y: number, angle: number, speed: number, color: number): void {
  const b = game.spawnBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, 'star');
  if (b) b.radius = 2.8;
}

export function emitChappy(game: Game, pattern: string, t: number): void {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  if (game.bombFrames > 0) return;
  if (pattern === 'codex' && t % CODEX_PERIOD[level] === 0) {
    const wave = Math.floor(t / CODEX_PERIOD[level]);
    for (const [i, [x, y]] of CHAPPY_PORTS.entries()) {
      const order = (i + wave) % 2;
      const b = source(game, 'codexBox', x, y + Math.sin(wave) * 14, CODEX_WARNING[level] + order * 34);
      if (b) { b.gridColumn = i; b.swayPhase = wave * 0.7; }
    }
  }
  // 下向きの扇だけだと上半面が丸ごと安全になる。回り込んだ自機には本体から薄い3wayを返す。
  if (pattern === 'codex' && game.py < 240 && t % [120, 108, 96, 84][level] === 0) {
    const [x, y] = game.bossPosition();
    const aim = Math.atan2(game.py - y, game.px - x);
    for (let i = -1; i <= 1; i++) {
      const angle = aim + i * 0.2;
      const b = game.spawnBullet(x, y, Math.cos(angle) * 1.3, Math.sin(angle) * 1.3, 1, 'orb');
      if (b) { b.radius = 2.8; b.delay = [48, 42, 36, 30][level]; }
    }
  }
  if (pattern === 'chappyParallel' && t % PARALLEL_BEAT[level] === 0) {
    const wave = Math.floor(t / PARALLEL_BEAT[level]);
    const [x, y] = CHAPPY_PORTS[wave % 2];
    const gap = Math.atan2(408 - y, [56, 160, 328, 224][wave % 4] - x);
    const aim = Math.atan2(game.py - y, game.px - x);
    const n = [18, 22, 26, 30][level];
    for (let i = 0; i < n; i++) {
      const angle = i * Math.PI * 2 / n + aim;
      // 広すぎる切れ目は左右の輪で共通の中央安全帯になる。下段の通路は波ごとに移す。
      if (Math.abs(Math.atan2(Math.sin(angle - gap), Math.cos(angle - gap))) < [0.38, 0.28, 0.24, 0.2][level]) continue;
      star(game, x, y, angle, [1.1, 1.3, 1.5, 1.7][level], wave % 2 ? 2 : 1);
    }
    game.spark(x, y, wave % 2 ? '#ffe6a1' : '#a5f5e6', 10);
  }
  if (pattern === 'chappyDelivery' && t % DELIVERY_PERIOD[level] === 0) {
    const wave = Math.floor(t / DELIVERY_PERIOD[level]);
    const b = source(game, 'chappyBloom', [112, 272, 192][wave % 3], [136, 160, 120][wave % 3], [100, 88, 76, 66][level]);
    if (b) b.swayPhase = Math.sin(wave * 0.9) * 0.48;
  }
}

// trueなら発射源として更新済み。無害な溜めを通常弾の移動・接触判定へ流さない。
export function updateChappySource(game: Game, b: Bullet): boolean {
  if (b.motion !== 'codexBox' && b.motion !== 'chappyBloom') return false;
  if (b.age <= CHAPPY_THROW) { b.x += b.vx; b.y += b.vy; }
  if (b.age === CHAPPY_THROW) { b.x = b.targetX; b.y = b.targetY; b.vx = 0; b.vy = 0; }
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const elapsed = b.age - b.releaseAt;
  if (b.motion === 'codexBox') {
    const interval = [34, 30, 26, 22][level];
    if (elapsed >= 0 && elapsed % interval === 0 && elapsed / interval < 4) {
      const aim = Math.PI / 2 + (b.gridColumn === 0 ? -0.13 : 0.13) + Math.sin(b.swayPhase + elapsed * 0.02) * 0.18;
      const n = [5, 7, 9, 11][level];
      for (let i = 0; i < n; i++) {
        const angle = aim + (i / (n - 1) - 0.5) * 1.2;
        const shot = game.spawnBullet(b.x, b.y + 14, Math.cos(angle) * [1.4, 1.65, 1.9, 2.15][level], Math.sin(angle) * [1.4, 1.65, 1.9, 2.15][level], b.gridColumn === 0 ? 1 : 2, 'orb');
        if (shot) shot.radius = 2.8;
      }
      game.spark(b.x, b.y + 14, '#b5f7e7', 4);
    }
    if (elapsed >= interval * 3 + 18) b.active = false;
  } else {
    if (elapsed >= 0 && elapsed % 22 === 0 && elapsed / 22 < 3) {
      const ring = elapsed / 22;
      const n = [24, 30, 36, 42][level];
      const gap = Math.PI / 2 + b.swayPhase;
      for (let i = 0; i < n; i++) {
        const angle = i * Math.PI * 2 / n + ring * 0.06;
        if (Math.abs(Math.atan2(Math.sin(angle - gap), Math.cos(angle - gap))) < [0.6, 0.5, 0.42, 0.36][level]) continue;
        star(game, b.x, b.y, angle, [1.0, 1.2, 1.4, 1.6][level] + ring * 0.18, [1, 2, 3][ring]);
      }
      game.spark(b.x, b.y, ['#b5f7e7', '#ffe8a0', '#ffc9e2'][ring], 18);
      if (ring === 0) { game.triggerBossCast(); game.audio.play('split'); }
    }
    if (elapsed >= 58) b.active = false;
  }
  return true;
}
