import { Game } from '/src/game.ts';
import { Renderer } from '/src/render.ts';
import { dialogue } from '/src/dialogue.ts';
import { FIELD } from '/src/rules.ts';
import { STAGES } from '/src/stages.ts';
import { CAROM_WARNING, yoyoPoint, yoyoStep, YOYO_WARNING, YOYO_FLIGHT } from '/src/patterns/chappy.ts';
import { graphEdgeDistance, graphEdgeState, graphNodeState } from '/src/patterns/obsidia-graph.ts';
import { ultimateCutin } from '/src/ultimate-cutin.ts';
import { PRAYER_CHARGE, PRAYER_FIRE, PRAYER_PERIOD, dawnPrayerStep } from '/src/patterns/minerva-dawn.ts';
import { REPRISE_HP_STEP } from '/src/patterns/minerva-reprise.ts';

export function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let n = state;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

const reflect = (n, low, high) => {
  const w = high - low, p = ((n - low) % (w * 2) + w * 2) % (w * 2);
  return low + (p <= w ? p : w * 2 - p);
};
const dirs = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
const horizons = [1, 2, 4, 7, 12, 20, 32, 48];

function predict(b, h, level) {
  if (b.delay > h) return null;
  if (b.motion === 'chappyYoyo') {
    const step = yoyoStep(b) + h;
    if (step <= YOYO_WARNING[level] || step >= YOYO_WARNING[level] + YOYO_FLIGHT[level]) return null;
    return yoyoPoint(b, (step - YOYO_WARNING[level]) / YOYO_FLIGHT[level]);
  }
  if (b.motion === 'chappyStitch') {
    if (b.age + h < CAROM_WARNING) return null;
    const moving = h - Math.max(0, CAROM_WARNING - b.age);
    return [reflect(b.x + b.vx * moving, b.radius + 3, 384 - b.radius - 3), reflect(b.y + b.vy * moving, b.radius + 3, 448 - b.radius - 3)];
  }
  if (b.motion === 'chappySugar' && b.age < b.releaseAt) {
    const remain = b.releaseAt - b.age;
    if (h < remain) return null;
    return [b.x + b.targetX * (h - remain + 1), b.y + 0.16 * remain + b.targetY * (h - remain + 1)];
  }
  return [b.x + b.vx * h, b.y + b.vy * h];
}

// ハーネスの18候補探索を継承。弾の未来位置は候補間で共有する。
function steer(g, level) {
  const bullets = g.bullets.objects.filter(b => b.active);
  const predictions = horizons.map(h => bullets.map(b => {
    const p = predict(b, h, level);
    return p && [p[0], p[1], b.radius + 3.5];
  }).filter(Boolean));
  let choice = [0, 0], focused = false, best = -Infinity;
  for (const focus of [false, true]) for (const [dx, dy] of dirs) {
    const speed = focus ? 1.65 : 3.65, norm = Math.hypot(dx, dy) || 1;
    let score = 0;
    for (let i = 0; i < horizons.length; i++) {
      const h = horizons[i];
      const x = Math.max(9, Math.min(375, g.px + dx / norm * speed * h));
      const y = Math.max(12, Math.min(439, g.py + dy / norm * speed * h));
      let clearance = 70;
      for (const [bx, by, r] of predictions[i]) clearance = Math.min(clearance, Math.hypot(x - bx, y - by) - r);
      for (const n of g.graphNodes) if (graphNodeState(n) === 'active') clearance = Math.min(clearance, Math.hypot(x - n.x, y - n.y) - n.radius - 4);
      for (const e of g.graphEdges) if (graphEdgeState(e) === 'active') clearance = Math.min(clearance, graphEdgeDistance(e, x, y) - 6);
      for (const laser of g.jinraiLasers) {
        if (laser.age + h < laser.warning || laser.age + h > laser.life) continue;
        const along = (x - laser.x) * Math.cos(laser.angle) + (y - laser.y) * Math.sin(laser.angle);
        if (along > 0) clearance = Math.min(clearance, Math.abs((x - laser.x) * Math.sin(laser.angle) - (y - laser.y) * Math.cos(laser.angle)) - 8);
      }
      score += Math.min(32, clearance) / (h + 3);
      if (clearance < 3) score -= (3 - clearance) * 180 / h;
      score -= Math.hypot(x - 192, y - 355) * 0.0015;
      if (y < 280) score -= (280 - y) * 1.5;
      if (y > 415) score -= (y - 415) * 2;
      if (x <= 12 || x >= 372) score -= 2;
    }
    if (score > best) { best = score; choice = [dx, dy]; focused = focus; }
  }
  g.keys.clear();
  if (choice[0] < 0) g.keys.add('ArrowLeft');
  if (choice[0] > 0) g.keys.add('ArrowRight');
  if (choice[1] < 0) g.keys.add('ArrowUp');
  if (choice[1] > 0) g.keys.add('ArrowDown');
  if (focused) g.keys.add('ShiftLeft');
}

export class Capture {
  constructor(pixelRatio) {
    this.ratio = pixelRatio;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640 * pixelRatio;
    this.canvas.height = 480 * pixelRatio;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    ctx.scale(pixelRatio, pixelRatio);
    this.renderer = new Renderer(ctx);
    this.renderer.setPixelRatio(pixelRatio);
    this.frame = -1;
  }

  async begin(cut) {
    this.heldHp = undefined;
    this.cut = cut;
    this.options = cut.capture;
    this.random = randomGenerator(this.options.seed);
    Math.random = this.random;
    this.game = new Game(false);
    const g = this.game, p = this.options;
    g.difficulty = p.difficulty;
    this.level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(p.difficulty);
    g.startStage(p.stage);
    g.audio.volume = 0;
    g.invincible = true;
    g.invulnFrames = 0;
    g.autoshot = true;
    g.power = p.power ?? 4;
    g.awakened = !!p.maxform;
    g.lives = 8;
    if (p.phase !== undefined) {
      g.startBoss(!!p.midboss, p.phase);
      if (cut.spell !== g.phase.name) throw new Error(`${cut.id}: 指定技 ${cut.spell} と実装 ${g.phase.name} が不一致`);
    }
    if (p.mode === 'dialogue') {
      g.boss = STAGES[p.stage - 1].boss;
      g.scene = 'dialogue';
      g.lines = dialogue('mimiko', g.boss, 'before');
      g.lineIndex = p.line ?? 0;
      g.afterDialogue = 'boss';
    }
    await Promise.all(Object.values(g.images).map(img => img.decode()));
    this.frame = -1;
    this.stats = { id: cut.id, frames: 0, minBullets: Infinity, maxBullets: 0, visibleHitFrames: 0, overlapFrames: 0, cutinFrames: 0, defeatFrames: 0, phase: g.phase?.name, difficulty: p.difficulty, seed: p.seed };
    for (let i = 0; i < p.warmup; i++) this.step(false);
    if (p.prayer) {
      const { cycle, frame = 0 } = p.prayer;
      if (p.stage !== 5 || p.phase !== 10 || p.midboss || ![3, 8, 12].includes(cycle)
        || !Number.isInteger(frame) || frame < 0 || frame >= PRAYER_PERIOD) throw new Error(`${cut.id}: 祈りの指定が不正です`);
      if (!g.minervaReprise || g.cutin > 0 || g.phaseFrame < 225 || g.minervaReprise.cycle >= cycle) throw new Error(`${cut.id}: warmupを離陸後・指定の祈りより前にしてください`);
      // 本体のHP境界を通し、弾消去・祈りの時計・難易度の初期化を本体に任せる。
      g.autoshot = false; g.shots.clear();
      for (let next = g.minervaReprise.cycle + 1; next <= cycle; next++) {
        g.phaseHp = g.phaseMaxHp * (1 - next * REPRISE_HP_STEP) - 0.000001;
        this.step(false);
        if (g.minervaReprise?.cycle !== next) throw new Error(`${cut.id}: 祈りへのHP境界遷移に失敗しました`);
        // 本気区間の宣言・補給中は次のHP境界へ進めない。本体の演出を完走する。
        let preparation = 0;
        while (g.minervaReprise.finale && preparation++ < 1800) this.step(false);
        if (g.minervaReprise.finale) throw new Error(`${cut.id}: 本気区間の準備が終了しませんでした`);
      }
      for (let i = 0; i < frame; i++) this.step(false);
      this.stats.prayerCycle = cycle;
      this.stats.prayerFrames = 0;
      this.stats.prayerChargeFrames = 0;
      this.stats.prayerFireFrames = 0;
    }
    if (p.holdHp) this.heldHp = g.phaseHp;
    this.frame = -1;
  }

  step(record = true) {
    const g = this.game, p = this.options;
    Math.random = this.random;
    if (this.frame % 2 === 0 || this.frame < 0) steer(g, this.level);
    if (record && this.heldHp !== undefined) g.phaseHp = this.heldHp;
    if (record && p.defeatAt !== undefined && this.frame + 1 >= p.defeatAt && g.phase) g.phaseHp = Math.min(g.phaseHp, 1);
    g.update();
    this.frame++;
    if (!record) return;
    const s = this.stats;
    s.frames++;
    s.minBullets = Math.min(s.minBullets, g.bullets.count);
    s.maxBullets = Math.max(s.maxBullets, g.bullets.count);
    if (g.pendingHit >= 0 || g.hitDuringSpell || g.lives < 8 || g.invulnFrames > 0) s.visibleHitFrames++;
    if (g.cutin > 0 && ultimateCutin(g.boss, g.phase?.pattern)) s.cutinFrames++;
    if (g.postBoss) s.defeatFrames++;
    if (p.prayer) {
      if (!g.minervaReprise?.prayer || g.minervaReprise.cycle !== p.prayer.cycle) throw new Error(`${this.cut.id}: 指定した祈りを離れました`);
      const step = dawnPrayerStep(g.phaseFrame, g.minervaReprise);
      s.prayerFrames++;
      if (step < PRAYER_CHARGE) s.prayerChargeFrames++;
      else if (step < PRAYER_CHARGE + PRAYER_FIRE) s.prayerFireFrames++;
    }
    if (g.bullets.objects.some(b => b.active && predict(b, 0, this.level) && Math.hypot(g.px - b.x, g.py - b.y) < b.radius + 2.5)) s.overlapFrames++;
    if (p.phase !== undefined && p.defeatAt === undefined && (!g.phase || g.phaseIndex !== p.phase)) throw new Error(`${this.cut.id}: 撮影中に指定フェーズが終了。warmupかカット長を短くしてください`);
    if (this.cut.kind === 'cutin' && !(g.cutin > 0 && ultimateCutin(g.boss, g.phase?.pattern))) throw new Error(`${this.cut.id}: 専用カットインの撮影可能時間を超えました`);
    if (g.scene === 'movie') throw new Error(`${this.cut.id}: 撮影中に動画へ移行。カットを短くしてください`);
  }

  drawTo(ctx, x) {
    const g = this.game;
    // 全幅カットインだけ別レイヤーへ描く。右パネルは一切コピーしない。
    const remaining = g.cutin;
    if (ultimateCutin(g.boss, g.phase?.pattern)) g.cutin = 0;
    this.renderer.draw(g);
    g.cutin = remaining;
    const r = this.ratio;
    ctx.drawImage(this.canvas, FIELD.x * r, FIELD.y * r, FIELD.w * r, FIELD.h * r, x, 0, 1080 * FIELD.w / FIELD.h, 1080);
  }
}
