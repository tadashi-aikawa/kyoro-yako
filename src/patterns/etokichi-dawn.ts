import type { Game } from '../game';

// 原作のスターリングとペンタグラムノヴァを、輪と五芒星の弾幕へ置き換える。
export function emitEtokichiDawn(game: Game, pattern: string, t: number): void {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  const [x, y] = game.bossPosition();
  if (pattern === 'etokichiStarRing') {
    if (t % [120, 100, 85, 70][level] !== 0) return;
    const wave = Math.floor(t / [120, 100, 85, 70][level]);
    const count = [20, 26, 32, 38][level];
    for (let ring = 0; ring < 2; ring++) for (let i = 0; i < count; i++) {
      const angle = (i + ring * 0.5) * Math.PI * 2 / count + wave * 0.19;
      const speed = 0.95 + ring * 0.45 + level * 0.1;
      const bullet = game.spawnBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, ring ? 2 : 1, 'star');
      if (!bullet) continue;
      bullet.motion = 'etokichiRing';
      bullet.spin = (ring ? -1 : 1) * 0.008;
      bullet.releaseAt = 90;
    }
  } else if (pattern === 'etokichiPentagramNova') {
    const local = t % 120;
    // 移動の跡を残し、一拍おいて放つ。行き先は生成時に確定し、追尾しない。
    if (local < 60 && t % [10, 8, 6, 5][level] === 0) {
      const angle = Math.atan2(game.py - y, game.px - x);
      for (const offset of [-0.2, 0.2]) {
        const speed = 1.45 + level * 0.15;
        const bullet = game.spawnBullet(x, y, Math.cos(angle + offset) * speed, Math.sin(angle + offset) * speed, 2, 'star');
        if (bullet) bullet.delay = 60;
      }
    }
    if (local !== 60) return;
    const spread = [1, 2, 2, 3][level];
    for (let arm = 0; arm < 5; arm++) for (let i = -spread; i <= spread; i++) {
      const angle = -Math.PI / 2 + arm * Math.PI * 2 / 5 + i * 0.065;
      const speed = 1.4 + level * 0.12 + (spread - Math.abs(i)) * 0.3;
      game.spawnBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, arm % 2 ? 0 : 1, 'star');
    }
  }
}
