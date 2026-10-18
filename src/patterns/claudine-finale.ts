import type { Game } from '../game';

// フェーズ時計で残り10秒から開始する。開始カットイン105f分だけ遅らせない。
export const FINALE_START = 3000;
export const FINALE_CHARGE = 60;
export const FINALE_CRESCENDO = 330;
export const ROSE_PERIOD = [48, 40, 34, 28] as const;
export const ROSE_COUNT = [36, 48, 60, 72] as const;

export function finaleTime(game: Game): number {
  return game.boss === 'claudine' && game.phase?.pattern === 'final' ? game.phaseFrame - FINALE_START : -1;
}

export function rosePulse(t: number, level: number): number {
  if (t < FINALE_CHARGE) return 0;
  return 1 - (t - FINALE_CHARGE) % ROSE_PERIOD[level] / ROSE_PERIOD[level];
}

export function emitClaudineFinale(game: Game, t: number): void {
  const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
  if (t === 0) {
    game.bullets.clear();
    game.audio.play('roseCharge');
  }
  if (t < FINALE_CHARGE) return;
  const [x, y] = game.bossPosition();
  const local = t - FINALE_CHARGE;
  if (local % ROSE_PERIOD[level] === 0) {
    const wave = Math.floor(local / ROSE_PERIOD[level]);
    const turn = wave * 0.19;
    const intensity = t >= FINALE_CRESCENDO ? 1.18 : 1;
    for (let i = 0; i < ROSE_COUNT[level]; i++) {
      const angle = i * Math.PI * 2 / ROSE_COUNT[level] + turn;
      // 6枚の花弁を、角度と色を変えて次々に開く。発射後の軌道は直線で読める。
      const speed = ([1.75, 2, 2.2, 2.4][level] + 0.55 * (1 + Math.cos(6 * (angle - turn)))) * intensity;
      const b = game.spawnBullet(x + Math.cos(angle) * 20, y + Math.sin(angle) * 20, Math.cos(angle) * speed, Math.sin(angle) * speed, wave % 2 ? 4 : 5, 'petal');
      if (b) { b.motion = 'farewellRose'; b.radius = 3; b.rotation = angle - Math.PI / 4; }
    }
    game.triggerBossCast();
    game.audio.play('roseBloom');
  }
  // 自機狙いは薔薇の斉射と半拍ずらす。追尾しないので、切り返しで誘導できる。
  const fanOffset = ROSE_PERIOD[level] / 2;
  if (local >= fanOffset && (local - fanOffset) % (ROSE_PERIOD[level] * 2) === 0) {
    const aim = Math.atan2(game.py - y, game.px - x);
    const count = [5, 7, 9, 11][level];
    const speed = [2.8, 3.1, 3.4, 3.7][level] * (t >= FINALE_CRESCENDO ? 1.12 : 1);
    for (let i = 0; i < count; i++) {
      const angle = aim + (i - (count - 1) / 2) * 0.11;
      const b = game.spawnBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 2, 'needle');
      if (b) { b.motion = 'farewellLance'; b.radius = 2.5; b.rotation = angle - Math.PI / 2; }
    }
  }
}
