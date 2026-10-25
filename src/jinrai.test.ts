import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { emitBossNormal, normalPeriod } from './patterns/boss-normal';
import { DASH_ATTACK, DASH_CHARGE_START, DASH_CHARGED, DASH_CUTIN, DASH_MOVE, dashBurstStep, dashCrossingX, dashMotion, emitJinraiPattern } from './patterns/jinrai';
import { CLONE_HOP, CLONE_SHOOT, CLONE_STAGGER, HOP_OUT, jinraiCloneScene } from './patterns/jinrai-clone';
import { KISS_CHARGE, KISS_FADE, KISS_LIFE, KISS_PERIOD, kissEdgeWarning, updateJinraiHeart } from './patterns/jinrai-kiss';
import { bulletSpeed } from './rules';
import { MID_PHASE, STAGES } from './stages';

const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void> = {};
beforeEach(() => {
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof listeners[string]) => { listeners[kind] = listener; } });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function phase(index: number): Game {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(4); game.startBoss(false, index);
  game.phaseFrame = index === 10 ? DASH_ATTACK - 1 : 104; game.update();
  return game;
}

function startDashBurst(game: Game): number {
  game.phaseHp = game.phaseMaxHp / 2;
  for (let frame = 0; frame < DASH_ATTACK + 300 && game.jinraiBurstStartFrame < 0; frame++) game.update();
  expect(game.jinraiBurstStartFrame).toBeGreaterThanOrEqual(0);
  return game.jinraiBurstStartFrame;
}

it('迅雷の11フェーズへ直行でき、Power 4.00の理論撃破時間は通常14秒・スペル25秒・一閃12.5秒になる', () => {
  const dps = (2 + Math.floor(4 / 2)) * 1.35 * (60 / 5);
  expect(dps).toBeCloseTo(64.8);
  expect(STAGES[3].phases).toHaveLength(11);
  STAGES[3].phases.forEach((p, index) => {
    vi.stubGlobal('location', { search: `?boss=4&phase=${index}` });
    const game = new Game(); game.audio.volume = 0;
    expect(game.phaseIndex).toBe(index);
    expect(game.phase).toBe(p);
    expect(p.hp / (dps * (p.pattern === 'jinraiDash' ? 2 : 1))).toBeCloseTo(p.pattern === 'jinraiDash' ? 12.5 : p.spell ? 25 : 14, 0);
    expect(p.duration).toBe(p.pattern === 'jinraiDash' ? Infinity : p.spell ? 60 : 40);
    expect(game.debugState).toMatchObject({ phaseRemainingSeconds: Number.isFinite(p.duration) ? p.duration : '∞', phaseHpRatio: 1 });
  });
  expect(MID_PHASE.jinrai.hp / dps).toBeCloseTo(18, 1);
  expect(MID_PHASE.jinrai.duration).toBe(45);
});

it('Power 4.00で本体を追いながら撃ち込むと全フェーズを60秒以内かつ制限時間内に倒せる', () => {
  for (let index = 0; index < STAGES[3].phases.length; index++) {
    const game = new Game(); game.audio.volume = 0; game.invincible = true;
    game.autoshot = true; game.power = 4;
    game.startStage(4); game.startBoss(false, index);
    const duration = Math.min(STAGES[3].phases[index].duration, 60) * 60;
    let elapsed = 0;
    while (elapsed < duration && game.phaseIndex === index) {
      game.px = game.bossXY[0];
      game.update();
      elapsed++;
    }
    expect(game.phaseIndex, `phase ${index}`).toBe(index + 1);
    expect(elapsed, `phase ${index} should end by damage`).toBeLessThan(duration);
  }
});

it('宵の誘いは予告のあと1発ずつ送り、画面外の弾も含めて数を制限する', () => {
  for (const [level, difficulty] of (['easy', 'normal', 'hard', 'lunatic'] as const).entries()) {
    const game = new Game(); game.audio.volume = 0; game.invincible = true;
    game.difficulty = difficulty; game.startStage(4); game.startBoss(false, 1);
    expect(game.phase?.name).toBe('宵の誘い');
    for (let t = 0; t < KISS_CHARGE; t++) emitJinraiPattern(game, 'jinraiKiss', t);
    expect(game.bullets.count).toBe(0);
    for (let t = KISS_CHARGE; t < KISS_PERIOD[level]; t++) emitJinraiPattern(game, 'jinraiKiss', t);
    const hearts = game.bullets.objects.filter((b) => b.active);
    expect(hearts).toHaveLength(1);
    expect(hearts.every((b) => b.kind === 'heart' && b.motion === 'jinraiHeart' && b.color === 3)).toBe(true);
    hearts[0].x = -80;
    for (let t = KISS_PERIOD[level]; t < KISS_LIFE * 2; t++) emitJinraiPattern(game, 'jinraiKiss', t);
    expect(game.bullets.count).toBe(Math.ceil(KISS_LIFE / KISS_PERIOD[level]));
  }
});

it('ハートは移動した自機へ旋回し、速度を保つ', () => {
  const game = phase(1);
  for (let i = 0; i < KISS_CHARGE; i++) game.update();
  const heart = game.bullets.objects.find((b) => b.active && b.motion === 'jinraiHeart')!;
  expect(heart).toBeDefined();
  heart.x = 192; heart.y = 150; heart.vx = 0; heart.vy = 1.95;
  game.px = 320; game.py = 380;
  for (let i = 0; i < 30; i++) game.update();
  expect(heart.vx).toBeGreaterThan(0.3);
  expect(Math.hypot(heart.vx, heart.vy)).toBeCloseTo(1.95);
  game.px = 30;
  const vx = heart.vx;
  game.update();
  expect(heart.vx).toBeLessThan(vx);
});

it('接近したハートは通り抜け、画面の外へ出ても再び戻ってくる', () => {
  const game = phase(1);
  emitJinraiPattern(game, 'jinraiKiss', KISS_CHARGE);
  const heart = game.bullets.objects.find((b) => b.active)!;
  heart.x = 192; heart.y = 380; heart.vx = 0; heart.vy = 1.95;
  game.px = 192; game.py = 398;
  let outside = false, returned = false;
  for (let i = 0; i < 300; i++) {
    game.update();
    expect(heart.active).toBe(true);
    expect(heart.motion).toBe('jinraiHeart');
    if (heart.y > 473) outside = true;
    if (outside && heart.y < 448) { returned = true; break; }
  }
  expect(outside).toBe(true);
  expect(returned).toBe(true);
});

it('ハートは最後の1秒だけ無害になり、10秒で光を残して消える', () => {
  for (const fading of [false, true]) {
    const game = phase(1);
    emitJinraiPattern(game, 'jinraiKiss', KISS_CHARGE);
    const heart = game.bullets.objects.find((b) => b.active)!;
    heart.x = game.px; heart.y = game.py; heart.vx = 0; heart.vy = 0;
    heart.age = KISS_LIFE - KISS_FADE - (fading ? 1 : 2);
    game.invincible = false; game.invulnFrames = 0;
    game.update();
    expect(game.pendingHit >= 0).toBe(!fading);
    heart.age = KISS_LIFE - 1;
    game.update();
    expect(heart.active).toBe(false);
    expect(game.particles.count).toBeGreaterThan(0);
  }
});

it('画面外のハートを四辺の印で示し、無害になると印を消す', () => {
  const game = phase(1);
  emitJinraiPattern(game, 'jinraiKiss', KISS_CHARGE);
  const heart = game.bullets.objects.find((b) => b.active)!;
  for (const [x, y, ex, ey] of [[-80, 200, 10, 200], [460, 200, 374, 200], [192, -80, 192, 10], [192, 560, 192, 438]]) {
    heart.x = x; heart.y = y;
    expect(kissEdgeWarning(heart)).toEqual([ex, ey]);
  }
  heart.x = 192; heart.y = 398;
  expect(kissEdgeWarning(heart)).toBeUndefined();
  heart.y = 530; heart.age = KISS_LIFE - KISS_FADE;
  expect(kissEdgeWarning(heart)).toBeUndefined();
});

it('技を倒したときは画面外のハートも画面内の得点アイテムに変える', () => {
  const game = phase(1);
  emitJinraiPattern(game, 'jinraiKiss', KISS_CHARGE);
  const heart = game.bullets.objects.find((b) => b.active)!;
  heart.x = 192; heart.y = 560;
  game.skipPhase(); game.update();
  const points = game.items.objects.filter((item) => item.active && item.kind === 'point');
  expect(points).toHaveLength(1);
  expect(points[0].y).toBeLessThan(448);
});

it('追尾は角度の±π境界でも最短方向へ曲がる', () => {
  const game = phase(1);
  emitJinraiPattern(game, 'jinraiKiss', KISS_CHARGE);
  const heart = game.bullets.objects.find((b) => b.active)!;
  heart.x = 192; heart.y = 200; heart.vx = -2; heart.vy = 0.001;
  updateJinraiHeart(heart, 30, 190);
  expect(heart.vy).toBeLessThan(0);
  expect(heart.vx).toBeLessThan(-1.99);
});

it('簪のレーザーは予告中に無害で、その後に回転する', () => {
  const game = phase(3);
  const laser = game.jinraiLasers[0];
  expect(laser).toBeDefined();
  const angle = laser.angle;
  for (let i = 0; i < laser.warning - 1; i++) game.update();
  expect(laser.angle).toBe(angle);
  game.update();
  expect(laser.angle).toBeGreaterThan(angle);
});

it('天雷招来は印の詠唱後に上端から雷を伸ばし、小弾を出さない', () => {
  const game = phase(5);
  expect(game.jinraiBolts).toHaveLength(0);
  for (let i = 0; i < 84; i++) game.update();
  expect(game.jinraiBolts).toHaveLength(1);
  expect(game.jinraiBolts[0].age).toBe(1);
  expect(game.bullets.count).toBe(0);
});

it('夜桜の舞は3色の小判定花びらを散らし、Normalで80〜150発を保つ', () => {
  let seed = 0x5a17c9e3;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  });
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(4); game.startBoss(false, 7);
  expect(game.phase).toMatchObject({ name: '夜桜の舞', pattern: 'jinraiSakura', hp: 1620, duration: 60 });
  const colors = new Set<number>();
  const sways = new Set<number>();
  for (let frame = 1; frame <= 3540; frame++) {
    game.update();
    for (const b of game.bullets.objects) if (b.active) {
      expect(b.kind).toBe('petal');
      expect(b.radius).toBe(2.2);
      colors.add(b.color); sways.add(b.sway);
    }
    if (frame < 360 || frame % 60 !== 0) continue;
    const visible = game.bullets.objects.filter((b) => b.active && b.x >= 0 && b.x <= 384 && b.y >= 0 && b.y <= 448).length;
    expect(visible, `frame ${frame}`).toBeGreaterThanOrEqual(80);
    expect(visible, `frame ${frame}`).toBeLessThanOrEqual(150);
  }
  expect(colors).toEqual(new Set([3, 4, 5]));
  expect(sways.size).toBeGreaterThan(20);
  // 59秒分の全弾を検証するため、CIの実行速度に余裕を持たせる。
}, 20_000);

it('夜桜の舞の突風は予告後90フレーム流し、風下の花びらを渦巻かせる', () => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(4); game.startBoss(false, 7);
  const petal = game.bullets.acquire();
  expect(petal).toBeDefined();
  if (!petal) return;
  Object.assign(petal, { x: 192, y: 220, vx: 0, vy: 1, radius: 2.2, kind: 'petal', motion: 'jinraiSakura', sway: 0, swayRate: 0, swayPhase: 0, rotation: 0, spin: 0, age: 0, delay: 0, fadeAt: 0 });
  game.jinraiWindDirection = 1;
  game.phaseFrame = 104 + 359;
  game.update();
  expect(petal.x).toBe(192);
  game.phaseFrame = 104 + 405;
  game.update();
  expect(petal.x).toBeCloseTo(193.8);
  petal.x = 350;
  game.phaseFrame = 104 + 450;
  const y = petal.y;
  game.update();
  expect(petal.y - y).toBeLessThan(1);
});

it('花吹雪は迅雷を起点として広がり続ける', () => {
  const game = phase(9);
  expect(game.phase?.name).toBe('花吹雪');
  const initial = game.bullets.objects.filter((b) => b.active);
  expect(initial.length).toBeGreaterThanOrEqual(6);
  expect(initial.every((b) => b.kind === 'petal')).toBe(true);
  const angle = Math.atan2(initial[0].vy, initial[0].vx);
  for (let i = 0; i < 60; i++) game.update();
  const minimumAge = Math.min(...game.bullets.objects.filter((b) => b.active).map((b) => b.age));
  const newest = game.bullets.objects.filter((b) => b.active && b.age === minimumAge);
  expect(game.bullets.count).toBeGreaterThan(initial.length);
  expect(newest.length).toBeGreaterThan(0);
  expect(Math.atan2(newest[0].vy, newest[0].vx)).not.toBeCloseTo(angle);
  expect(game.bullets.objects.some((b) => b.active && b.vy < 0)).toBe(true);
  expect(game.bullets.objects.some((b) => b.active && b.vy > 0)).toBe(true);
});

it('花吹雪は難易度が上がるほど螺旋の腕を増やす', () => {
  let previous = 0;
  for (const [index, difficulty] of (['easy', 'normal', 'hard', 'lunatic'] as const).entries()) {
    const game = new Game(); game.audio.volume = 0; game.invincible = true;
    game.difficulty = difficulty; game.startStage(4); game.startBoss(false, 9);
    game.phaseFrame = 104; game.update();
    expect(game.bullets.count, `difficulty ${index}`).toBeGreaterThan(previous);
    previous = game.bullets.count;
  }
});

it('一閃はゆっくり移動し、印から1秒後にカットインを挟んで充電を続ける', () => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  const play = vi.spyOn(game.audio, 'play');
  game.startStage(4); game.startBoss(false, 10);
  expect(game.cutin).toBe(0);
  expect(DASH_CHARGED - (DASH_CUTIN + 100)).toBeGreaterThanOrEqual(60);
  expect(play).not.toHaveBeenCalledWith('declare');
  expect(play).not.toHaveBeenCalledWith('jinraiCharge');
  const hp = game.phaseHp;
  game.autoshot = true; game.power = 5;
  for (let frame = 1; frame < DASH_ATTACK; frame++) {
    game.px = game.bossXY[0]; game.update();
    expect(game.bullets.count).toBe(0);
    expect(game.jinraiDashTick).toBe(-1);
    expect(game.phaseHp).toBe(hp);
    if (frame < DASH_CHARGED) expect(play).not.toHaveBeenCalledWith('jinraiCrackle');
    if (frame === DASH_CHARGED) {
      expect(play).toHaveBeenCalledWith('jinraiCrackle');
      expect(game.bossXY).toEqual([192, 132]);
    }
    expect(game.cutin).toBe(frame >= DASH_CUTIN ? Math.max(0, 100 - frame + DASH_CUTIN) : 0);
    if (frame < DASH_CHARGE_START) expect(play).not.toHaveBeenCalledWith('jinraiCharge');
    if (frame === DASH_CHARGE_START) expect(play).toHaveBeenCalledWith('jinraiCharge');
  }
  game.update();
  expect(game.jinraiDashTick).toBe(0);
  expect(game.bossXY).toEqual([24, 115]);
  expect(game.cutin).toBe(0);
  expect(play.mock.calls.filter(([sound]) => sound === 'declare')).toHaveLength(1);
  expect(play.mock.calls.filter(([sound]) => sound === 'jinraiCharge')).toHaveLength(1);
  expect(play.mock.calls.filter(([sound]) => sound === 'jinraiCrackle')).toHaveLength(1);
});

it('一閃の横断は12フレームで加速・減速し、左右で対称に駆け抜ける', () => {
  const left = Array.from({ length: DASH_MOVE + 1 }, (_, frame) => dashCrossingX(1, frame));
  const speed = left.slice(1).map((x, i) => x - left[i]);
  expect(left[0]).toBe(24); expect(left.at(-1)).toBe(360);
  expect(Math.max(...speed)).toBeGreaterThan(60);
  expect(speed[0]).toBeLessThan(2); expect(speed.at(-1)).toBeLessThan(2);
  for (let i = 0; i <= DASH_MOVE; i++) expect(dashCrossingX(-1, i)).toBeCloseTo(384 - left[i]);
});

it('一閃は時間制限∞・体力1620のスペルで、時間切れにならず撃破すると終了する', () => {
  const game = phase(10);
  expect(game.phase).toMatchObject({ kind: 'spell', duration: Infinity, hp: 1620 });
  game.phaseFrame = 60 * 60 - 1;
  for (let frame = 0; frame < 120; frame++) game.update();
  expect(game.phaseIndex).toBe(10);
  expect(game.phaseHp).toBe(1620);
  expect(game.debugState.phaseRemainingSeconds).toBe('∞');
  while (dashMotion(game).local < dashMotion(game).warning + DASH_MOVE) game.update();
  const [x, y] = game.bossXY;
  Object.assign(game.shots.acquire()!, { x, y, vx: 0, vy: 0, damage: game.phaseHp, radius: 3, homing: false });
  game.update();
  game.update();
  expect(game.phaseIndex).toBe(11);
});

it('一閃のボーナスはミネルヴァ最終技と同じ速度で減衰し、0で止まる', () => {
  for (const stage of [4, 5]) {
    const game = new Game(); game.audio.volume = 0; game.invincible = true;
    game.startStage(stage); game.startBoss(false, 10);
    const bonus = game.spellBonus;
    for (let frame = 0; frame < 120; frame++) game.update();
    expect(game.spellBonus).toBe(bonus - 22 * 120);
    game.spellBonus = 10; game.update();
    expect(game.spellBonus).toBe(0);
  }
});

it.each([DASH_ATTACK + 25, 1300, 4000])('一閃は体力50%%超では発散せず、50%%到達後の横断終了から発散する: frame %s', (frame) => {
  const game = phase(10);
  const play = vi.spyOn(game.audio, 'play');
  game.phaseHp = game.phaseMaxHp / 2 + 1;
  while (game.phaseFrame < frame) game.update();
  expect(game.jinraiBurstStartFrame).toBe(-1);
  expect(dashBurstStep(game)).toBe(-1);
  expect(play).not.toHaveBeenCalledWith('ninpo');
  expect(play).not.toHaveBeenCalledWith('thunderBurst');
  const end = game.phaseFrame + 90 - game.jinraiDashTick;
  game.phaseHp = game.phaseMaxHp / 2;
  while (game.phaseFrame < end - 1) {
    game.update(); expect(dashBurstStep(game)).toBe(-1);
  }
  game.update();
  expect(game.jinraiBurstStartFrame).toBe(end);
  expect(dashBurstStep(game)).toBe(0);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('一閃の発散は8秒経過後の最初の往復終了まで待ち、発射待ちの列を残さない: %s', (difficulty) => {
  const game = phase(10); game.difficulty = difficulty;
  const first = startDashBurst(game);
  const pending = () => game.bullets.objects.filter((b) => b.active && b.motion === 'jinraiHold');
  expect(pending()).toHaveLength(0);
  for (let count = 2; count <= 4; count++) {
    const previous = game.jinraiBurstStartFrame;
    while (game.phaseFrame < previous + 480) game.update();
    expect(game.jinraiBurstStartFrame).toBe(previous);
    expect(game.jinraiDashDouble).toBe(true);
    expect(dashBurstStep(game)).toBe(-1);
    const end = game.phaseFrame + 170 - game.jinraiDashTick;
    expect(end).toBeGreaterThan(previous + 480);
    const crossing = game.jinraiDashCrossing;
    while (game.phaseFrame < end - 1) {
      game.update();
      expect(game.jinraiBurstStartFrame).toBe(previous);
      expect(dashBurstStep(game)).toBe(-1);
    }
    expect(game.jinraiDashTick).toBe(169);
    expect(game.jinraiDashCrossing).toBe(crossing + 1);
    const held = pending();
    expect(held.length).toBeGreaterThan(0);
    expect(held.every((b) => b.releaseAt > 0)).toBe(true);
    game.update();
    expect(game.jinraiBurstStartFrame).toBe(end);
    expect(game.jinraiBurstCount).toBe(count);
    expect(dashBurstStep(game)).toBe(0);
    expect(pending()).toHaveLength(0);
    expect(held.every((b) => !b.active)).toBe(true);
    while (dashBurstStep(game) >= 0) {
      expect(pending()).toHaveLength(0);
      game.update();
    }
  }
  expect(game.jinraiBurstStartFrame).toBeGreaterThan(first + 3 * 480);
});

it('一閃の中央発散タイマーはフェーズ開始でリセットする', () => {
  const game = phase(10); startDashBurst(game);
  game.startBoss(false, 10);
  expect(game.jinraiBurstStartFrame).toBe(-1);
  expect(game.jinraiBurstCount).toBe(0);
  expect(dashBurstStep(game)).toBe(-1);
});

it('一閃は開幕から体力半分以下なら最初の往復が終わってから発散する', () => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(4); game.startBoss(false, 10);
  game.phaseHp = game.phaseMaxHp / 2;
  while (game.phaseFrame < DASH_ATTACK + 84) game.update();
  expect(game.jinraiDashDouble).toBe(true);
  expect(game.jinraiDashTick).toBe(84);
  expect(game.jinraiDashCrossing).toBe(0);
  expect(dashBurstStep(game)).toBe(-1);
  game.update();
  expect(dashBurstStep(game)).toBe(-1);
  expect(game.jinraiDashCrossing).toBe(1);
  while (game.phaseFrame < DASH_ATTACK + 169) game.update();
  expect(game.jinraiDashTick).toBe(169);
  expect(dashBurstStep(game)).toBe(-1);
  game.update();
  expect(dashBurstStep(game)).toBe(0);
  expect(game.jinraiDashCrossing).toBe(1);
});

it('一閃は体力半分以下で煙で消えて中央へ瞬間移動し、雷と花びらを三連発散して横断へ戻る', () => {
  const game = phase(10);
  const play = vi.spyOn(game.audio, 'play');
  game.phaseHp = game.phaseMaxHp / 2;
  while (game.jinraiDashTick < 89) game.update();
  const before = game.bossXY;
  game.update();
  const start = game.jinraiBurstStartFrame;
  expect(game.bossXY).toEqual(before);
  while (game.phaseFrame < start + 17) game.update();
  expect(game.bossXY).toEqual(before);
  expect(play).toHaveBeenCalledWith('ninpo');
  while (game.phaseFrame < start + 18) game.update();
  expect(game.bossXY).toEqual([192, 224]);
  const crossing = game.jinraiDashCrossing;
  while (game.phaseFrame < start + 48) game.update();
  expect(game.jinraiBurstFlashUntil).toBeGreaterThan(game.phaseFrame);
  expect(game.bullets.objects.some((b) => b.active && b.age === 1 && b.kind === 'needle')).toBe(true);
  expect(game.bullets.objects.some((b) => b.active && b.age === 1 && b.kind === 'petal')).toBe(true);
  expect(game.bullets.objects.filter((b) => b.active && b.age === 1)).toHaveLength(56);
  while (game.phaseFrame < start + 84) game.update();
  expect(play.mock.calls.filter(([sound]) => sound === 'thunderBurst')).toHaveLength(3);
  while (game.phaseFrame < start + 120) game.update();
  expect(game.jinraiDashCrossing).toBe(crossing + 1);
  expect(game.jinraiDashTick).toBe(0);
  while (game.phaseFrame < start + 480) game.update();
  expect(game.bossXY.every(Number.isFinite)).toBe(true);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('一閃の発散は針も花びらも通常攻撃より気持ち速い: %s', (difficulty) => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.difficulty = difficulty; game.startStage(4); game.startBoss(false, 10);
  const start = startDashBurst(game);
  while (game.phaseFrame < start + 48) game.update();
  const speeds = (kind: string) => game.bullets.objects.filter((b) => b.active && b.age === 1 && b.kind === kind).map((b) => Math.hypot(b.vx, b.vy));
  const normal = bulletSpeed(difficulty, 5.1);
  for (const kind of ['needle', 'petal']) {
    expect(Math.min(...speeds(kind)), kind).toBeGreaterThan(normal);
    expect(Math.max(...speeds(kind)), kind).toBeLessThan(normal * 1.15);
  }
});

it('忍術で消えている間はショットが本体のいた場所を通り抜ける', () => {
  const game = phase(10);
  const start = startDashBurst(game);
  while (game.phaseFrame < start + 9) game.update();
  const [x, y] = game.bossXY;
  const hp = game.phaseHp;
  const shot = game.shots.acquire()!;
  Object.assign(shot, { x, y, vx: 0, vy: 0, damage: 10, radius: 3, homing: false });
  game.update();
  expect(game.phaseHp).toBe(hp);
  expect(shot.active).toBe(true);
  while (game.phaseFrame < start + 29) game.update();
  shot.x = 192; shot.y = 224;
  game.update();
  expect(game.phaseHp).toBe(hp - 20);
  expect(shot.active).toBe(false);
});

it.each(['easy', 'normal', 'hard', 'lunatic'] as const)('迅雷一閃だけショットとボムの初撃・継続ダメージが2倍になる: %s', (difficulty) => {
  for (let index = 0; index < STAGES[3].phases.length; index++) {
    const game = phase(index); game.difficulty = difficulty;
    const multiplier = index === 10 ? 2 : 1;
    const hp = game.phaseHp;
    const [x, y] = game.bossXY;
    Object.assign(game.shots.acquire()!, { x, y, vx: 0, vy: 0, damage: 1.35, radius: 3, homing: false });
    game.update();
    expect(hp - game.phaseHp, `phase ${index} shot`).toBeCloseTo(1.35 * multiplier);
    const afterShot = game.phaseHp;
    game.frame = 108;
    listeners.keydown({ code: 'KeyX', repeat: false, preventDefault: () => {} });
    game.update(); game.keys.delete('KeyX');
    expect(afterShot - game.phaseHp, `phase ${index} bomb`).toBe(36 * multiplier);
    const afterBomb = game.phaseHp;
    game.update();
    expect(afterBomb - game.phaseHp, `phase ${index} bomb tick`).toBe(2.5 * multiplier);
  }
});

it('一閃は16px間隔の列に切れ目を作り、停止後に光って時間差で飛ぶ', () => {
  const game = phase(10);
  while (game.jinraiDashTick < 45) game.update();
  const held = game.bullets.objects.filter((b) => b.active && b.motion === 'jinraiHold');
  expect(held).toHaveLength(20);
  expect(held.every((b) => b.y === 115)).toBe(true);
  const positions = held.map((b) => b.x).sort((a, b) => a - b);
  const spacing = positions.slice(1).map((x, i) => x - positions[i]);
  expect(spacing.filter((gap) => gap > 40)).toHaveLength(1);
  expect(spacing.filter((gap) => gap < 40).every((gap) => gap > 14 && gap < 17)).toBe(true);
  while (game.jinraiDashTick < 52) game.update();
  expect(held.every((b) => b.vx === 0 && b.vy === 0)).toBe(true);
  while (game.jinraiDashTick < 62) game.update();
  expect(held.every((b) => b.releaseAt > game.phaseFrame)).toBe(true);
  while (game.jinraiDashTick < 72) game.update();
  expect(held.some((b) => b.motion === 'normal')).toBe(true);
  expect(held.some((b) => b.motion === 'jinraiHold')).toBe(true);
  while (held.some((b) => b.motion === 'jinraiHold')) game.update();
  expect(held.every((b) => b.motion === 'normal')).toBe(true);
});

it('一閃の高さは3段を巡回し、体力半分以下では次の巡回から往復する', () => {
  const game = phase(10);
  expect(game.bossXY[1]).toBe(115);
  game.phaseHp = game.phaseMaxHp / 2;
  while (game.jinraiDashCrossing < 1) game.update();
  expect(game.jinraiDashDouble).toBe(true);
  expect(game.bossXY[1]).toBe(170);
  const firstDirection = game.jinraiDashDirection;
  while (game.jinraiDashCrossing < 2) game.update();
  expect(game.jinraiDashTick).toBe(85);
  expect(game.bossXY[1]).toBe(225);
  expect(game.jinraiDashDirection).toBe(-firstDirection);
  expect(game.bossXY[1]).toBeLessThanOrEqual(398 - 120);
});

it('一閃はNormalの進行中に画面内へ40〜90発を維持する', () => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(4); game.startBoss(false, 10);
  while (game.phaseFrame < DASH_ATTACK - 105) game.update();
  for (let frame = 1; frame <= 720; frame++) {
    game.update();
    if (frame < 240 || frame % 60 !== 0) continue;
    const visible = game.bullets.objects.filter((b) => b.active && b.x >= 0 && b.x <= 384 && b.y >= 0 && b.y <= 448).length;
    expect(visible, `frame ${frame}`).toBeGreaterThanOrEqual(40);
    expect(visible, `frame ${frame}`).toBeLessThanOrEqual(90);
  }
});

it('一閃の後半の横断もNormalは40〜90発に収まり、Lunaticの列にも切れ目が残る', () => {
  const normal = phase(10);
  normal.phaseHp = normal.phaseMaxHp / 2;
  for (let frame = 1; frame <= 600; frame++) {
    normal.update();
    if (frame < 240 || frame % 60 !== 0) continue;
    // 中央発散と横断の再開直後は除き、列が画面内に揃ってから数える。
    if (normal.phaseFrame - normal.jinraiBurstStartFrame < 240) continue;
    const visible = normal.bullets.objects.filter((b) => b.active && b.x >= 0 && b.x <= 384 && b.y >= 0 && b.y <= 448).length;
    expect(visible, `frame ${frame}`).toBeGreaterThanOrEqual(40);
    expect(visible, `frame ${frame}`).toBeLessThanOrEqual(90);
  }
  const lunatic = new Game(); lunatic.audio.volume = 0; lunatic.invincible = true;
  lunatic.difficulty = 'lunatic'; lunatic.startStage(4); lunatic.startBoss(false, 10);
  while (lunatic.jinraiDashTick < 37) lunatic.update();
  const positions = lunatic.bullets.objects.filter((b) => b.active && b.dashWave === 0).map((b) => b.x).sort((a, b) => a - b);
  expect(positions).toHaveLength(20);
  expect(positions.slice(1).filter((x, i) => x - positions[i] > 40)).toHaveLength(1);
});

it('中ボスは分身せず、単身から左右にずれた針の扇を二連射する', () => {
  const game = new Game(); game.audio.volume = 0; game.invincible = true;
  game.startStage(4); game.startBoss(true, 0);
  expect(game.phase).toMatchObject({ name: '宵雷の扇', pattern: 'jinraiFan', kind: 'midboss' });
  game.phaseFrame = 104; game.update();
  expect(game.bossTargets()).toHaveLength(1);
  const first = game.bullets.objects.filter((b) => b.active);
  expect(first).toHaveLength(13);
  expect(first.every((b) => b.kind === 'needle')).toBe(true);
  for (let frame = 0; frame < 18; frame++) game.update();
  const second = game.bullets.objects.filter((b) => b.active && b.age === 1);
  expect(second).toHaveLength(13);
  expect(Math.atan2(first[6].vy, first[6].vx)).not.toBeCloseTo(Math.atan2(second[6].vy, second[6].vx));
});

it('花影の3人は全難易度で通常攻撃と同じ針弾を同じタイミングで放つ', () => {
  for (const difficulty of ['easy', 'normal', 'hard', 'lunatic'] as const) {
    const game = phase(8); game.difficulty = difficulty;
    const beat = normalPeriod(game, 84);
    for (let t = 0; t < beat * 2; t++) {
      game.phaseFrame = 2610 + t;
      game.bullets.clear(); emitJinraiPattern(game, 'jinraiClone', t);
      const actual = game.bullets.objects.filter((b) => b.active).map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, radius: b.radius, kind: b.kind, color: b.color }));
      expect(actual.length % 3).toBe(0);
      for (const [index, origin] of game.bossTargets().entries()) {
        game.bullets.clear(); emitBossNormal(game, 'jinraiRapidFan', t, origin);
        const expected = game.bullets.objects.filter((b) => b.active).map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, radius: b.radius, kind: b.kind, color: b.color }));
        expect(actual.slice(index * expected.length, (index + 1) * expected.length)).toEqual(expected);
      }
    }
  }
});

it('花影はどの分身への命中も共有HPを減らし、被弾後も全員の位置が変わらない', () => {
  const game = phase(8);
  game.phaseFrame = 2610;
  const positions = game.bossTargets();
  const hp = game.phaseHp;
  for (const [index, [x, y]] of positions.entries()) {
    const shot = game.shots.acquire()!;
    Object.assign(shot, { x, y, vx: 0, vy: 0, radius: 3, damage: 10, homing: false });
    game.update();
    expect(game.phaseHp).toBe(hp - (index + 1) * 10);
    expect(shot.active).toBe(false);
    expect(game.bossTargets()).toEqual(positions);
  }
  // 1発が複数人へ重なってもダメージを重複させない。
  const shot = game.shots.acquire()!;
  Object.assign(shot, { x: 192, y: 132, vx: 0, vy: 0, radius: 130, damage: 10, homing: false });
  game.update();
  expect(game.phaseHp).toBe(hp - 40);
});

it('ホーミングは最寄りの分身を狙い、次フェーズでは単身へ戻る', () => {
  const game = phase(8);
  game.phaseFrame = 2610;
  const shot = game.shots.acquire()!;
  Object.assign(shot, { x: 72, y: 230, vx: 0, vy: -8, radius: 3, damage: 1, homing: true });
  game.update();
  expect(shot.vx).toBeCloseTo((86 - 72) / 55);
  game.skipPhase();
  while (game.collectionFrames > 0) game.update();
  expect(game.phase?.pattern).toBe('jinraiPetal');
  expect(game.bossTargets()).toHaveLength(1);
});

it('花影は単身で5秒撃ち、印を結んで溜めたあと2秒かけて二身になる', () => {
  const game = phase(8);
  expect(game.bossTargets()).toEqual([[192, 124]]);
  expect(game.bullets.count).toBe(14);
  game.phaseFrame = 404; game.update();
  expect(game.bullets.count).toBe(0);
  expect(jinraiCloneScene(405).charging).toBe(true);
  expect(game.bossTargets()).toHaveLength(1);
  for (let frame = 406; frame < 615; frame++) {
    game.update(); expect(game.bullets.count).toBe(0);
  }
  const halfway = jinraiCloneScene(555);
  expect(halfway.bodies).toEqual([{ x: 154, y: 133, opacity: 1 }, { x: 230, y: 133, opacity: 0.5 }]);
  game.update();
  expect(game.bossTargets()).toEqual([[116, 142], [268, 142]]);
  expect(game.bullets.count).toBe(28);
});

it('花影は残り30秒では二身のまま、残り20秒で射撃を止めて溜めてから三身になる', () => {
  expect(jinraiCloneScene(1800).bodies).toHaveLength(2);
  expect(jinraiCloneScene(1800).charging).toBe(false);
  const game = phase(8); game.phaseFrame = 2399; game.update();
  expect(game.bossTargets()).toEqual([[72, 116], [312, 116]]);
  expect(jinraiCloneScene(2400).charging).toBe(true);
  expect(game.bullets.count).toBe(0);
  for (let frame = 2401; frame < 2610; frame++) {
    game.update(); expect(game.bullets.count).toBe(0);
  }
  expect(jinraiCloneScene(2550).bodies).toEqual([{ x: 79, y: 129, opacity: 1 }, { x: 192, y: 124, opacity: 0.5 }, { x: 305, y: 129, opacity: 1 }]);
  game.update();
  expect(game.bossTargets()).toEqual([[86, 142], [192, 124], [298, 142]]);
  expect(game.bullets.count).toBe(42);
});

it('花影の分身は4秒撃つごとに残像を残して跳び、少しずつずれて全員が撃たない間を作る', () => {
  for (const [shotStart, count] of [[615, 2], [2610, 3]] as const) {
    const before = jinraiCloneScene(shotStart + CLONE_SHOOT - 1);
    expect(before.firing).toEqual(Array(count).fill(true));
    // 跳び始めは分身ごとにずれる。
    const starts = before.bodies.map((_, index) => {
      let frame = shotStart;
      while (jinraiCloneScene(frame).firing[index]) frame++;
      return frame;
    });
    expect(starts).toEqual(Array.from({ length: count }, (_, index) => shotStart + CLONE_SHOOT + index * CLONE_STAGGER));
    const hop = jinraiCloneScene(starts[0] + HOP_OUT);
    expect(hop.bodies[0].opacity).toBe(0);
    expect(hop.trails[0]).toMatchObject({ fromX: before.bodies[0].x, fromY: before.bodies[0].y });
    expect([hop.bodies[0].x, hop.bodies[0].y]).not.toEqual([before.bodies[0].x, before.bodies[0].y]);
    let quiet = 0;
    for (let frame = starts[0]; frame < starts[0] + CLONE_HOP + count * CLONE_STAGGER; frame++) if (!jinraiCloneScene(frame).firing.some(Boolean)) quiet++;
    expect(quiet).toBe(CLONE_HOP - (count - 1) * CLONE_STAGGER);
    const back = jinraiCloneScene(starts[count - 1] + CLONE_HOP);
    expect(back.firing).toEqual(Array(count).fill(true));
    expect(back.bodies.every((body) => body.opacity === 1)).toBe(true);
  }
});

it('花影で跳んでいる分身は撃たず、残る分身だけが撃つ', () => {
  const game = phase(8);
  const start = 615 + CLONE_SHOOT;
  let volleys = 0;
  for (let frame = start; frame < start + CLONE_STAGGER; frame++) {
    game.phaseFrame = frame;
    game.bullets.clear(); emitJinraiPattern(game, 'jinraiClone', frame - 615);
    const shots = game.bullets.objects.filter((b) => b.active);
    if (shots.length) volleys++;
    expect(shots.every((b) => b.x === 268 && b.y === 142)).toBe(true);
  }
  expect(volleys).toBeGreaterThan(0);
});

it('二身で祈っている間も両方への命中を受け付ける', () => {
  const game = phase(8); game.phaseFrame = 2400;
  const hp = game.phaseHp;
  for (const [x, y] of game.bossTargets()) {
    const shot = game.shots.acquire()!;
    Object.assign(shot, { x, y, vx: 0, vy: 0, radius: 3, damage: 10, homing: false });
  }
  game.update();
  expect(game.phaseHp).toBe(hp - 20);
});
