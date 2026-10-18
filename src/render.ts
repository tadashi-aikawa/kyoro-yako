import { bossSpriteId, createBossMotion, isCasting, updateBossMotion } from './boss-motion';
import { ENEMY_ROOMS, enemyPose } from './enemy-design';
import type { Bullet, Clone, Enemy, Game, Item } from './game';
import { PLAYER_NAMES, PLAYERS, SAKURA_GUST, SAKURA_PERIOD, SAKURA_SWIRL, SAKURA_WARNING } from './game';
import { normalBeat } from './patterns/boss-normal';
import { bowProgress, claudineScene, complementBoundary, FAREWELL_RELEASE, flowerRadius, whiteSpaceCircle } from './patterns/claudine';
import { GRID_COLUMNS, GRID_DIRECTIONS, GRID_NAMES, GRID_PERIOD, GRID_REPLAY_PERIOD, gridLayoutAt, gridPoint, gridRows, gridVelocity, RAIN_FONTS, RAIN_GLYPHS, WEATHER_NAMES, WEATHER_PERIOD, WEATHER_REPLAY_PERIOD, weatherAt } from './patterns/claudine-weather-grid';
import { BURST_MOVE, BURST_RETURN, BURST_SHOTS, burstVisibility, dashBurstStep } from './patterns/jinrai';
import { jinraiCloneScene } from './patterns/jinrai-clone';
import { DAWN_PERIOD, dawnLane, dawnPrayerStep, eyeX, HYPOTHESIS_COLUMNS, HYPOTHESIS_PERIOD, hypothesisBrightness, hypothesisSide, hypothesisX, MINERVA_WARNING, PRAYER_CHARGE, PRAYER_FIRE } from './patterns/minerva';
import { bogs } from './patterns/neo';
import { encoreBogTime } from './patterns/neo-encore';
import { SWEEP_CHARGE, SWEEP_MOVE, SWEEP_PERIOD, SWEEP_SHOTS, sweepStep, sweepTarget, tags } from './patterns/obsidia';
import { FIELD } from './rules';
import { drawScenery } from './stage-scenery';
import { NAMES, STAGES } from './stages';
import { GAME_TITLE, RECORDS } from './story';
import { wrapDialogue } from './text-layout';

const PALETTE = ['#a674ff', '#6ddaf5', '#fbd768', '#ff9dbe'];

export class Renderer {
  private readonly sprites = new Map<string, HTMLCanvasElement>();
  private readonly bossMotion = createBossMotion();
  private readonly titleArt = Object.assign(new Image(), { src: `${import.meta.env.BASE_URL}assets/title/key-visual.webp` });
  private titleLayer?: HTMLCanvasElement;
  private pixelRatio = 1;
  constructor(private readonly ctx: CanvasRenderingContext2D) {
    this.setPixelRatio(1);
  }

  setPixelRatio(pixelRatio: number): void {
    this.pixelRatio = pixelRatio;
    this.titleLayer = undefined;
    this.sprites.clear();
    for (const kind of ['orb', 'needle', 'petal', 'star', 'glyph', 'keycap']) for (let color = 0; color < (kind === 'petal' ? 6 : 4); color++) for (let variant = 0; variant < (kind === 'star' ? 16 : kind === 'glyph' ? 1 + RAIN_GLYPHS.length * RAIN_FONTS.length : 1); variant++) {
      const canvas = document.createElement('canvas'); canvas.width = Math.ceil(28 * pixelRatio); canvas.height = Math.ceil(28 * pixelRatio);
      const c = canvas.getContext('2d')!;
      c.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      c.imageSmoothingQuality = 'high';
      c.translate(14, 14);
      if (kind === 'star') c.rotate(variant * Math.PI / 8);
      const tint = color === 4 ? '#f6bfd5' : color === 5 ? '#d969a1' : PALETTE[color];
      c.shadowColor = tint; c.shadowBlur = 7;
      c.fillStyle = tint; c.strokeStyle = '#fff'; c.lineWidth = 1;
      if (kind === 'orb') { c.beginPath(); c.arc(0, 0, 4, 0, Math.PI * 2); c.fill(); c.stroke(); }
      if (kind === 'needle') { c.beginPath(); c.ellipse(0, 0, 2.5, 7, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
      if (kind === 'petal') { c.rotate(Math.PI / 4); c.beginPath(); c.ellipse(0, 0, 4, 7, 0, 0, Math.PI * 2); c.fill(); }
      if (kind === 'star') { c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const r = i % 2 ? 3 : 8; if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r); else c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke(); }
      if (kind === 'glyph') {
        c.font = variant === 0 ? 'bold 13px serif' : RAIN_FONTS[(variant - 1) % RAIN_FONTS.length];
        c.textAlign = 'center'; c.textBaseline = 'middle';
        if (variant > 0) c.shadowBlur = 3;
        c.fillText(variant === 0 ? ['A', 'あ', '¶', '梟'][color] : RAIN_GLYPHS[Math.floor((variant - 1) / RAIN_FONTS.length)], 0, 0);
      }
      if (kind === 'keycap') { c.beginPath(); c.roundRect(-7, -6, 14, 12, 2); c.fill(); c.stroke(); c.fillStyle = '#261d42'; c.font = 'bold 8px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(['Z', 'X', '⌘', '↵'][color], 0, 0); }
      this.sprites.set(`${kind}-${color}-${variant}`, canvas);
    }
  }

  draw(game: Game): void {
    const c = this.ctx;
    c.fillStyle = '#080817'; c.fillRect(0, 0, 640, 480);
    if (game.scene === 'title' || game.scene === 'difficulty' || game.scene === 'player' || game.scene === 'practice' || game.scene === 'option' || game.scene === 'help' || game.scene === 'notebook') {
      this.drawMenu(game);
      return;
    }
    if (game.scene === 'ending' || game.scene === 'credits') { this.drawEnding(game); return; }
    this.drawField(game);
    this.drawPanel(game);
    if (game.scene === 'dialogue') this.drawDialogue(game);
    if (game.scene === 'clear' || game.scene === 'pause' || game.scene === 'gameover') this.drawOverlay(game);
    if (import.meta.env.DEV) { this.text(`FPS ${game.fps.toFixed(0)}`, 37, 456, 9, '#ccd4ee'); }
  }

  private text(value: string, x: number, y: number, size = 14, color = '#fff', align: CanvasTextAlign = 'left'): void {
    const c = this.ctx;
    c.font = `${size}px "Hiragino Mincho ProN", "Yu Mincho", serif`;
    c.textAlign = align; c.textBaseline = 'middle';
    c.shadowColor = '#080714'; c.shadowBlur = 4;
    c.fillStyle = color; c.fillText(value, x, y);
    c.shadowBlur = 0;
  }

  private uiText(value: string, x: number, y: number, size = 12, color = '#e8e2d4', align: CanvasTextAlign = 'left', maxWidth?: number): void {
    const c = this.ctx;
    c.font = `${size}px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
    if (maxWidth && c.measureText(value).width > maxWidth) {
      c.font = `${size * maxWidth / c.measureText(value).width}px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
    }
    c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = color; c.fillText(value, x, y);
  }

  private card(x: number, y: number, w: number, h: number, fill: string, border: string): void {
    const c = this.ctx; c.fillStyle = fill; c.strokeStyle = border; c.lineWidth = 1;
    c.beginPath(); c.roundRect(x, y, w, h, 9); c.fill(); c.stroke();
  }

  private drawTitle(game: Game): void {
    const c = this.ctx;
    // 絵と題字は毎フレーム描くとフレームレートが半分に落ちるので、一度だけ描いて使い回す。
    if (!this.titleLayer) this.titleLayer = this.renderTitleLayer();
    if (this.titleLayer) c.drawImage(this.titleLayer, 0, 0, 640, 480);
    this.stars(game.frame, 640, 480, 0.16);

    const entries = ['はじめる', '練習', '音の設定', '遊び方', '冒険ノート'];
    entries.forEach((label, i) => {
      const y = 262 + i * 34; const selected = i === game.menu;
      if (selected) {
        const glow = c.createLinearGradient(44, 0, 250, 0);
        glow.addColorStop(0, 'rgba(234,211,154,0)'); glow.addColorStop(0.15, 'rgba(234,211,154,0.18)'); glow.addColorStop(1, 'rgba(234,211,154,0)');
        c.fillStyle = glow; c.fillRect(44, y - 13, 206, 26);
        const pulse = 0.75 + Math.sin(game.frame * 0.08) * 0.25;
        c.fillStyle = `rgba(246,232,198,${pulse})`;
        c.beginPath(); c.moveTo(56, y - 4); c.lineTo(60, y); c.lineTo(56, y + 4); c.lineTo(52, y); c.closePath(); c.fill();
      }
      this.text(label, 72, y, 17, selected ? '#f6e8c6' : 'rgba(196,198,218,0.62)');
    });
  }

  private renderTitleLayer(): HTMLCanvasElement | undefined {
    const art = this.titleArt;
    if (!art.complete || !art.naturalWidth) return undefined;
    const layer = document.createElement('canvas');
    layer.width = Math.ceil(640 * this.pixelRatio); layer.height = Math.ceil(480 * this.pixelRatio);
    const c = layer.getContext('2d')!;
    c.setTransform(layer.width / 640, 0, 0, layer.height / 480, 0, 0);
    c.imageSmoothingQuality = 'high';
    const scale = Math.max(640 / art.naturalWidth, 480 / art.naturalHeight);
    const w = art.naturalWidth * scale; const h = art.naturalHeight * scale;
    c.drawImage(art, (640 - w) / 2, (480 - h) / 2, w, h);
    // 題字とメニューの下だけ夜を深くする。
    const veil = c.createLinearGradient(0, 0, 380, 0);
    veil.addColorStop(0, 'rgba(5,8,22,0.82)'); veil.addColorStop(0.55, 'rgba(5,8,22,0.45)'); veil.addColorStop(1, 'rgba(5,8,22,0)');
    c.fillStyle = veil; c.fillRect(0, 0, 380, 480);

    c.font = '52px "Hiragino Mincho ProN", "Yu Mincho", serif';
    c.letterSpacing = '8px';
    c.textAlign = 'left'; c.textBaseline = 'middle';
    const gold = c.createLinearGradient(0, 86, 0, 138);
    gold.addColorStop(0, '#fff6dc'); gold.addColorStop(0.55, '#ead39a'); gold.addColorStop(1, '#b8945a');
    c.shadowColor = 'rgba(240,210,140,0.45)'; c.shadowBlur = 18;
    c.fillStyle = gold; c.fillText(GAME_TITLE, 50, 112);
    c.shadowBlur = 0;
    const rule = c.createLinearGradient(52, 0, 270, 0);
    rule.addColorStop(0, 'rgba(234,211,154,0.7)'); rule.addColorStop(1, 'rgba(234,211,154,0)');
    c.fillStyle = rule; c.fillRect(52, 150, 218, 1);
    return layer;
  }

  private image(game: Game, id: string, x: number, y: number, w: number, h: number, alpha = 1): void {
    const image = game.images[id];
    if (!image?.complete || !image.naturalWidth) return;
    const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    const c = this.ctx; c.save(); c.globalAlpha = alpha;
    c.drawImage(image, x + (w - drawW) / 2, y + h - drawH, drawW, drawH);
    c.restore();
  }

  private drawMenu(game: Game): void {
    const c = this.ctx;
    if (game.scene === 'title') {
      c.fillStyle = '#11192e'; c.fillRect(0, 0, 640, 480);
      this.drawTitle(game);
      return;
    }
    const background = c.createLinearGradient(0, 0, 640, 480);
    background.addColorStop(0, '#101535'); background.addColorStop(0.55, '#292244'); background.addColorStop(1, '#533b57');
    c.fillStyle = background; c.fillRect(0, 0, 640, 480);
    this.stars(game.frame, 640, 480, 0.45);
    for (let i = 0; i < 6; i++) {
      c.strokeStyle = `rgba(225,206,255,${0.045 + i * 0.012})`;
      c.beginPath(); c.arc(320, 440, 80 + i * 38 + Math.sin(game.frame * 0.01) * 4, 0, Math.PI * 2); c.stroke();
    }
    if (game.scene === 'notebook') { this.drawNotebook(game); return; }
    if (game.scene === 'difficulty') { this.text('難易度を選択', 320, 86, 30, '#fff2d6', 'center'); this.menuEntries(['Easy', 'Normal', 'Hard', 'Lunatic'], game.menu, 158); }
    if (game.scene === 'player') {
      this.text('自機を選択', 320, 65, 30, '#fff2d6', 'center');
      for (let i = 0; i < PLAYERS.length; i++) {
        const x = 320 + (i - (PLAYERS.length - 1) / 2) * 166 - 58;
        c.fillStyle = i === game.menu ? '#c3a5ff55' : '#aaaacc22'; c.fillRect(x - 7, 128, 130, 202);
        this.image(game, `${PLAYERS[i]}-face`, x, 135, 116, 116, i === game.menu ? 1 : 0.58);
        this.text(PLAYER_NAMES[PLAYERS[i]], x + 57, 286, 18, i === game.menu ? '#fff5d8' : '#aba6bd', 'center');
      }
      this.text('追尾する羽 / 書いて残す七重の頁', 320, 381, 14, '#e7daf8', 'center');
    }
    if (game.scene === 'practice') { this.text('Practice', 320, 80, 30, '#fff2d6', 'center'); this.menuEntries(STAGES.slice(0, game.unlockedStages).map((s, i) => `Stage ${i + 1}  ${s.title}`), game.menu, 160, 18); }
    if (game.scene === 'option') {
      this.text('Option', 320, 98, 30, '#fff2d6', 'center');
      this.text(`${game.menu === 0 ? '◆ ' : '   '}効果音   ◀  ${game.optionVolume}%  ▶`, 320, 212, 20, game.menu === 0 ? '#fff' : '#aaa9c1', 'center');
      this.text(`${game.menu === 1 ? '◆ ' : '   '}BGM      ◀  ${game.optionBgmVolume}%  ▶`, 320, 266, 20, game.menu === 1 ? '#fff' : '#aaa9c1', 'center');
    }
    if (game.scene === 'help') {
      this.text('操作説明', 320, 66, 30, '#fff2d6', 'center');
      ['矢印キー  移動', 'Shift  低速移動・当たり判定表示', 'Z  ショット / 決定 / 会話送り', 'X  ボム / 戻る', 'Esc  ポーズ', 'Ctrl  会話早送り', '上部へ移動するとアイテムを自動回収'].forEach((line, i) => { this.text(line, 320, 145 + i * 36, 17, '#eee9f4', 'center'); });
    }
    this.text('Z 決定   X 戻る', 320, 448, 11, '#aaa4c7', 'center');
  }

  private menuEntries(entries: string[], selected: number, y: number, size = 22): void {
    entries.forEach((entry, i) => {
      if (selected === i) this.text('◆', 211, y + i * 42, 13, '#f4d696');
      this.text(entry, 320, y + i * 42, size, selected === i ? '#fff4d8' : '#aaa9c1', 'center');
    });
  }

  private drawNotebook(game: Game): void {
    this.text('みみこの冒険ノート', 320, 55, 28, '#f4e5c3', 'center');
    this.uiText(`集めた記録 ${game.collectedRecords.length} / 5 頁`, 320, 91, 12, '#b9cfc1', 'center');
    RECORDS.forEach((record, i) => {
      const selected = game.menu === i;
      const found = game.collectedRecords.includes(i + 1);
      const y = 135 + i * 53;
      this.card(29, y, 147, 42, selected ? '#dacfb0' : '#172337', selected ? '#dacfb0' : '#44504c');
      this.uiText(`${i + 1}階  ${['門', '書庫', '回廊', '夜桜', '天文台'][i]}`, 41, y + 14, 12, selected ? '#24332f' : '#e2decc');
      this.uiText(found ? record.title.split('：')[1] : 'まだ書かれていない頁', 41, y + 31, 9, selected ? '#526257' : '#899ca5', 'left', 123);
    });
    this.card(190, 135, 420, 254, '#ded6be', '#e8dcba');
    const record = RECORDS[game.menu];
    const found = game.collectedRecords.includes(game.menu + 1);
    this.uiText(found ? record.title : `${game.menu + 1}階：まだ見ぬ記録`, 211, 166, 18, '#354b42', 'left', 378);
    const c = this.ctx;
    c.strokeStyle = '#8caa9855';
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(212, 231 + i * 31); c.lineTo(587, 231 + i * 31); c.stroke(); }
    const lines = found ? record.lines : ['この階をクリアすると、記録が残ります。', '頁の続きは、あなたの手で確かめて。'];
    lines.forEach((line, i) => { this.uiText(line, 212, 219 + i * 31, 14, '#35453f', 'left', 375); });
    this.uiText('書いて残さないと、なかったことになるの。', 212, 365, 11, '#6b7668');
    this.uiText('↑ ↓ 頁を選択   Z / X タイトルへ', 320, 445, 11, '#c3caba', 'center');
  }

  private enemy(game: Game, enemy: Enemy): void {
    const image = game.images[`enemy-${ENEMY_ROOMS[game.stage - 1]}`];
    if (!image?.complete || !image.naturalWidth) { this.owl(enemy, game.frame); return; }
    const pose = enemyPose(enemy, game.stage, game.px, game.py);
    const cell = image.naturalWidth / 3;
    const c = this.ctx;
    c.save(); c.translate(enemy.x, enemy.y + Math.sin(enemy.age * 0.08) * 1.5);
    c.rotate(pose === 2 ? Math.sin(enemy.hitFrames * 0.9) * 0.1 : Math.sin(enemy.age * 0.035) * 0.035);
    const size = enemy.kind === 'ring' ? 47 : 39;
    if (pose === 1) {
      const glow = c.createRadialGradient(0, 0, 2, 0, 0, size * 0.6);
      glow.addColorStop(0, '#f9df9b45'); glow.addColorStop(1, '#f9df9b00');
      c.fillStyle = glow; c.fillRect(-size, -size, size * 2, size * 2);
    }
    c.drawImage(image, pose * cell, 0, cell, image.naturalHeight, -size / 2, -size / 2, size, size);
    c.restore();
  }

  private stars(frame: number, width: number, height: number, alpha: number): void {
    const c = this.ctx;
    c.fillStyle = `rgba(244,233,255,${alpha})`;
    for (let i = 0; i < 75; i++) {
      const x = (i * 191 + i * i * 17) % width;
      const y = (i * 127 + Math.floor(frame * (i % 3 + 1) * 0.35)) % height;
      c.fillRect(x, y, i % 8 === 0 ? 2 : 1, i % 8 === 0 ? 2 : 1);
    }
  }

  private drawField(game: Game): void {
    const c = this.ctx;
    const stage = STAGES[game.stage - 1];
    c.save(); c.translate(FIELD.x, FIELD.y);
    c.beginPath(); c.rect(0, 0, FIELD.w, FIELD.h); c.clip();
    drawScenery(c, game);
    if (game.phase?.spell) {
      c.fillStyle = '#06031977'; c.fillRect(0, 0, FIELD.w, FIELD.h);
      this.magic(192, 80, game.frame, stage.colors[2], 130, 0.25);
    }
    if (game.phase && game.boss) {
      const [x, y] = game.bossXY;
      const burst = game.phase.pattern === 'jinraiDash' ? dashBurstStep(game.phaseFrame) : -1;
      const seal = burst >= BURST_MOVE && burst < BURST_RETURN;
      const prayer = game.phase.pattern === 'owlDawn' ? dawnPrayerStep(game.phaseFrame) : -1;
      const praying = prayer >= 0 && prayer < PRAYER_CHARGE;
      const channeling = prayer >= 0 && prayer < PRAYER_CHARGE + PRAYER_FIRE;
      const sweepLevel = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
      const sweep = game.phase.pattern === 'sweep' ? sweepStep(game.phaseFrame, sweepLevel) : -1;
      const sweepCharging = sweep >= SWEEP_MOVE && sweep < SWEEP_MOVE + SWEEP_CHARGE[sweepLevel];
      if (sweepCharging) {
        const progress = (sweep - SWEEP_MOVE) / SWEEP_CHARGE[sweepLevel];
        const aura = c.createRadialGradient(x, y, 5, x, y, 75);
        aura.addColorStop(0, '#e6c4ff88'); aura.addColorStop(1, '#b976ff00');
        c.fillStyle = aura; c.beginPath(); c.arc(x, y, 75, 0, Math.PI * 2); c.fill();
        for (let i = 0; i < 3; i++) this.magic(x, y, game.frame * (i % 2 ? -1 : 1), '#e9d2ff', 68 - progress * 35 + i * 9, 0.25 + progress * 0.3);
      }
      if (channeling) {
        c.save();
        const progress = praying ? prayer / PRAYER_CHARGE : 1;
        const intensity = praying ? 0.6 + progress * 0.4 : 0.85;
        c.globalAlpha = intensity;
        const aura = c.createRadialGradient(x, y, 12, x, y, 108);
        aura.addColorStop(0, '#fffad9d0'); aura.addColorStop(0.35, '#fff5bd88');
        aura.addColorStop(0.7, '#fff0a838'); aura.addColorStop(1, '#fff5bd00');
        c.fillStyle = aura; c.beginPath(); c.arc(x, y, 108, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#fff5bd'; c.shadowColor = '#ffdb72'; c.shadowBlur = 14;
        c.lineWidth = praying ? 3 + progress * 3 : 2;
        for (let i = 0; i < 2; i++) {
          const radius = 48 + i * 20 - progress * 9;
          c.globalAlpha = intensity * (praying ? 0.4 : 0.2);
          c.beginPath(); c.ellipse(x, y + 8, radius, radius * 0.6, i * Math.PI / 2 + game.frame * 0.012, 0, Math.PI * 2); c.stroke();
        }
        c.shadowBlur = 0; c.globalAlpha = intensity;
        for (let i = 0; i < 3; i++) this.magic(x, y, game.frame * (i % 2 ? -0.7 : 0.7), '#fff4bd', 44 + (game.frame * 0.3 + i * 18) % 54, intensity * 0.35);
        c.fillStyle = '#fffce3';
        for (let i = 0; i < 12; i++) {
          const angle = i * Math.PI / 6 + game.frame * 0.009;
          const radius = 58 + Math.sin(game.frame * 0.035 + i) * 8;
          c.beginPath(); c.arc(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 1.6, 0, Math.PI * 2); c.fill();
        }
        c.restore();
      }
      if (!seal && game.phase.pattern !== 'jinraiClone') this.magic(x, y, game.frame, stage.colors[2], 38, 0.7 * burstVisibility(burst));
      if (game.phase.pattern === 'jinraiClone') {
        const scene = jinraiCloneScene(game.phaseFrame, game.phase.duration);
        const performingNinpo = scene.charging || scene.splitting;
        for (const [index, body] of scene.bodies.entries()) {
          if (body.opacity <= 0) continue;
          c.save(); c.globalAlpha = body.opacity;
          if (scene.charging) {
            const radius = 60 - scene.chargeProgress * 25;
            c.shadowColor = '#e8c7ff'; c.shadowBlur = 10 + scene.chargeProgress * 18;
            this.magic(body.x, body.y, -game.frame * 0.6, '#e8c7ff', radius, 0.5);
            this.magic(body.x, body.y, game.frame, '#fff4bd', 30 + scene.chargeProgress * 10, 0.6);
          }
          const breathing = scene.charging ? 1 + Math.sin(game.frame * 0.09) * 0.025 : 1;
          this.fieldCharacter(game, performingNinpo ? 'jinrai-seal' : this.readySprite(game, bossSpriteId(game.boss, 'idle', game.frame + index * 7)), body.x, body.y + (performingNinpo ? 0 : Math.sin(game.frame * 0.045) * 2), 64 * breathing, 0, body.opacity);
          this.magic(body.x, body.y, game.frame, '#ffdc84', 25, 0.4 * body.opacity);
          c.restore();
        }
      } else {
        const bow = game.boss === 'claudine' && game.phase.pattern === 'final' ? bowProgress(game.phaseFrame - 105) : 0;
        const tilt = channeling || seal || sweepCharging ? 0 : Math.cos(game.phaseFrame * 0.012) * 0.045 + bow * 0.08;
        const pose = updateBossMotion(this.bossMotion, `${game.boss}:${game.phase.name}`, game.frame, x);
        const casting = isCasting(game.phase.kind, game.phaseFrame, game.phase.kind === 'normal' ? normalBeat(game, game.phase.pattern) : 0);
        const bossSprite = this.readySprite(game, bossSpriteId(game.boss, casting ? 'cast' : pose, game.frame));
        c.save(); c.translate(x, y); c.scale(1 + bow * 0.08, 1 - bow * 0.32); c.translate(-x, -y);
        if (seal) { c.shadowColor = '#ffe591'; c.shadowBlur = 8 + Math.min(20, (burst - BURST_MOVE) * 0.6); }
        this.fieldCharacter(game, channeling ? 'minerva-prayer' : seal ? 'jinrai-seal' : sweepCharging ? 'obsidia-sweep' : bossSprite, x, y + (channeling || seal || sweepCharging ? 0 : Math.sin(game.frame * 0.045) * 2) + bow * 10, 64, tilt, burstVisibility(burst));
        c.restore();
      }
      c.fillStyle = '#140c27aa'; c.fillRect(15, 6, 350, 13);
      c.fillStyle = '#e4aeea'; c.fillRect(17, 8, 346 * Math.max(0, game.phaseHp / game.phaseMaxHp), 9);
      this.text(NAMES[game.boss], 18, 29, 12, '#f9ebff');
      this.text('★'.repeat(game.remainingSpells), 330, 29, 12, '#ffe1a7', 'right');
      this.text(`${Math.ceil((game.phase.duration * 60 - game.phaseFrame) / 60)}`, 367, 29, 14, '#fff', 'right');
    }
    game.enemies.forEach((enemy) => { this.enemy(game, enemy); });
    game.clones.forEach((clone) => { this.clone(clone, game.frame); });
    game.items.forEach((item) => { this.item(item); });
    this.jinraiSpellTelegraphs(game);
    this.stageTelegraphs(game);
    this.minervaTelegraphs(game);
    for (const owl of game.dawnOwls) {
      c.save();
      c.globalAlpha = owl.age <= owl.warning ? 0.35 + 0.2 * Math.sin(owl.age * 0.25) : 1;
      if (owl.age <= owl.warning) this.magic(owl.x, owl.y, game.frame, '#fff0b2', 27, 0.8);
      this.owl(owl, game.frame);
      c.restore();
    }
    game.bullets.forEach((b) => { this.bullet(b); });
    game.shots.forEach((shot) => { c.fillStyle = '#a9f7ff'; c.shadowColor = c.fillStyle; c.shadowBlur = 6; c.fillRect(shot.x - shot.radius, shot.y - 6, shot.radius * 2, 12); c.shadowBlur = 0; });
    game.particles.forEach((p) => { c.globalAlpha = 1 - p.age / p.life; c.fillStyle = p.color; c.fillRect(p.x, p.y, p.size, p.size); c.globalAlpha = 1; });
    this.player(game);
    if (game.bombFrames > 0) this.bombEffect(game);
    if (game.cutin > 0 && game.boss) this.cutin(game);
    if (game.phase?.spell && game.cutin <= 20) {
      const progress = Math.min(1, game.phaseFrame / 60);
      const eased = 1 - (1 - progress) ** 3;
      const y = 43 + (260 - 43) * (1 - eased);
      const failed = game.hitDuringSpell || game.bombUsed || game.pendingHit >= 0;
      c.fillStyle = '#160e30e8'; c.fillRect(84, y, 300, 44);
      c.strokeStyle = '#d5ace680'; c.strokeRect(84.5, y + 0.5, 299, 43);
      this.text(game.phase.name, 373, y + 15, 13, '#fff2dd', 'right');
      this.text(failed ? 'Failed' : `BONUS  ${game.spellBonus.toLocaleString()}`, 373, y + 34, 11, failed ? '#ff9da8' : '#ffe0aa', 'right');
    }
    if (game.messageFrames > 0) {
      c.globalAlpha = Math.min(1, game.messageFrames / 30);
      this.text(game.message, 192, 205, game.message.length > 28 ? 15 : 21, '#fff5cd', 'center');
      c.globalAlpha = 1;
    }
    if (game.flash > 0) { c.fillStyle = `rgba(255,255,255,${game.flash / 50})`; c.fillRect(0, 0, FIELD.w, FIELD.h); }
    this.focusMarker(game);
    c.restore();
    c.strokeStyle = '#b5a8d4'; c.lineWidth = 2; c.strokeRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
  }

  private magic(x: number, y: number, frame: number, color: string, radius: number, alpha: number): void {
    const c = this.ctx; c.save(); c.translate(x, y); c.rotate(frame * 0.006); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = 1.5;
    for (const r of [radius, radius * 0.7, radius * 0.45]) { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); }
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a) * radius * 0.4, Math.sin(a) * radius * 0.4); c.lineTo(Math.cos(a + Math.PI / 3) * radius, Math.sin(a + Math.PI / 3) * radius); c.stroke(); }
    c.restore();
  }

  private jinraiSpellTelegraphs(game: Game): void {
    const pattern = game.phase?.pattern;
    if (!pattern?.startsWith('jinrai') || game.phase?.kind === 'normal') return;
    const c = this.ctx;
    const t = game.phaseFrame - 105;
    if (pattern === 'jinraiSakura' && t >= SAKURA_PERIOD) {
      const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
      const windFrame = (t - SAKURA_PERIOD) % SAKURA_PERIOD;
      const warning = SAKURA_WARNING[level];
      const direction = game.jinraiWindDirection;
      if (windFrame < warning) {
        const progress = windFrame / warning;
        c.save(); c.strokeStyle = '#ffe5f080'; c.lineWidth = 1.5;
        for (let i = 0; i < 7; i++) {
          const head = direction > 0 ? -75 + progress * (FIELD.w + 150) + i * 11 : FIELD.w + 75 - progress * (FIELD.w + 150) - i * 11;
          const y = 55 + i * 53;
          c.beginPath(); c.moveTo(head - direction * 75, y + Math.sin(i * 2.4) * 5);
          c.lineTo(head, y); c.stroke();
        }
        c.restore();
      } else if (windFrame < warning + SAKURA_GUST) {
        c.save(); c.strokeStyle = '#ffe8f144'; c.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const x = (windFrame * 7 + i * 83) % (FIELD.w + 100) - 50;
          const y = 44 + i * 70;
          c.beginPath(); c.moveTo(x - direction * 55, y); c.lineTo(x, y - 4); c.stroke();
        }
        c.restore();
      } else if (windFrame < warning + SAKURA_GUST + SAKURA_SWIRL) {
        c.save(); c.strokeStyle = '#ffc6dd88'; c.lineWidth = 1;
        const x = direction > 0 ? FIELD.w - 44 : 44;
        for (let i = 0; i < 3; i++) {
          c.beginPath(); c.arc(x, 140 + i * 105, 16 + i * 3, windFrame * 0.15, windFrame * 0.15 + Math.PI * 1.4); c.stroke();
        }
        c.restore();
      }
    }
    if (pattern === 'jinraiBounce' && t >= 0) {
      const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
      const cycle = t % [118, 105, 94, 82][level];
      if (cycle < [43, 36, 30, 25][level]) {
        const [x, y] = game.bossXY;
        c.strokeStyle = '#ffe7a777'; c.lineWidth = 2;
        for (let i = 0; i < [3, 4, 5, 6][level]; i++) {
          const vx = (i % 2 ? 1 : -1) * (1.8 + level * 0.16);
          const vy = 0.9 + Math.floor(i / 2) * 0.25;
          const travel = (i % 2 ? FIELD.w - 8 - x : x - 8) / Math.abs(vx);
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + vx * travel, y + vy * travel); c.stroke();
        }
      }
    }
    if (pattern === 'jinraiDash' && t >= 0) {
      const burst = dashBurstStep(game.phaseFrame);
      if (burst >= 0 && burst < 24) this.ninjaSmoke(game.jinraiBurstFromX, game.jinraiBurstFromY, burst);
      if (burst >= BURST_MOVE && burst < BURST_MOVE + 24) this.ninjaSmoke(192, 224, burst - BURST_MOVE);
      if (game.phaseFrame < game.jinraiBurstFlashUntil) this.burstLightning(game.phaseFrame, game.jinraiBurstFlashUntil - game.phaseFrame);
      const tick = game.jinraiDashTick;
      const local = tick - (game.jinraiDashDouble && tick >= 85 ? 85 : 0);
      const warning = [30, 24, 20, 16][['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty)];
      if (burst < 0 && local < warning) {
        c.strokeStyle = '#ffe9adbb'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(24, game.jinraiDashY); c.lineTo(360, game.jinraiDashY); c.stroke();
        this.magic(game.bossXY[0], game.jinraiDashY, game.frame, '#fff0bc', 40, 0.6);
      }
      if (game.phaseFrame < game.jinraiDashFlashUntil) {
        c.save(); c.strokeStyle = '#fff6ca'; c.lineWidth = 4;
        c.shadowColor = '#ffe691'; c.shadowBlur = 18;
        c.beginPath(); c.moveTo(24, game.jinraiDashY); c.lineTo(360, game.jinraiDashY); c.stroke();
        c.restore();
      }
      c.strokeStyle = '#fff1b9bb'; c.lineWidth = 1.5;
      game.bullets.forEach((b) => {
        if (b.motion !== 'jinraiHold' || b.releaseAt <= 0) return;
        const angle = Math.atan2(b.targetY - b.y, b.targetX - b.x);
        c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x + Math.cos(angle) * 13, b.y + Math.sin(angle) * 13); c.stroke();
      });
      if (burst >= BURST_MOVE && burst < BURST_RETURN) {
        c.save(); c.strokeStyle = '#fff3bf'; c.shadowColor = '#ffe282'; c.shadowBlur = 18;
        for (let i = 0; i < 2; i++) {
          const pulse = 48 + i * 12 + Math.sin(game.frame * 0.16) * 3;
          c.lineWidth = 1.5;
          c.beginPath(); c.arc(192, 224, pulse, 0, Math.PI * 2); c.stroke();
        }
        c.lineWidth = game.phaseFrame < game.jinraiBurstFlashUntil ? 3 : 1;
        const radius = burst < BURST_SHOTS[0] ? 70 - (burst - BURST_MOVE) * 0.5 : 68;
        c.beginPath(); c.arc(192, 224, radius, 0, Math.PI * 2); c.stroke();
        if (game.phaseFrame < game.jinraiBurstFlashUntil) for (let i = 0; i < 8; i++) {
          const angle = i * Math.PI / 4 + burst * 0.015;
          c.beginPath(); c.moveTo(192 + Math.cos(angle) * 24, 224 + Math.sin(angle) * 24);
          c.lineTo(192 + Math.cos(angle + 0.1) * 48, 224 + Math.sin(angle + 0.1) * 48);
          c.lineTo(192 + Math.cos(angle) * 85, 224 + Math.sin(angle) * 85); c.stroke();
        }
        c.restore();
      }
    }
    for (const laser of game.jinraiLasers) {
      const warning = laser.age <= laser.warning;
      c.strokeStyle = warning ? '#ffd9f4aa' : '#ff87cbe8';
      c.lineWidth = warning ? 1.5 : 13;
      c.shadowColor = '#ff83cc'; c.shadowBlur = warning ? 0 : 13;
      c.beginPath(); c.moveTo(laser.x, laser.y); c.lineTo(laser.x + Math.cos(laser.angle) * 520, laser.y + Math.sin(laser.angle) * 520); c.stroke();
      c.shadowBlur = 0;
      if (!warning) { c.strokeStyle = '#fff0f8'; c.lineWidth = 2; c.stroke(); }
    }
    for (const mark of game.jinraiMarks) {
      if (mark.age < mark.warning) {
        this.magic(mark.x, mark.y, game.frame, '#ffe66c', 24 + 9 * mark.age / mark.warning, 0.8);
        c.strokeStyle = '#ffe66c55'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(mark.x, 0); c.lineTo(mark.x, mark.y); c.stroke();
      } else {
        c.strokeStyle = '#fff4aa'; c.lineWidth = 8; c.shadowColor = '#ffe565'; c.shadowBlur = 18;
        c.beginPath(); c.moveTo(mark.x, 0); c.lineTo(mark.x, mark.y); c.stroke();
        c.shadowBlur = 0;
      }
    }
  }

  private ninjaSmoke(x: number, y: number, age: number): void {
    const c = this.ctx;
    c.save(); c.globalAlpha = (1 - age / 24) * 0.7;
    for (let i = 0; i < 9; i++) {
      const angle = i * Math.PI * 2 / 9;
      const radius = 5 + age * 1.7;
      const sx = x + Math.cos(angle) * radius;
      const sy = y - 15 + Math.sin(angle) * radius * 0.7 - age * 0.6;
      const smoke = c.createRadialGradient(sx, sy, 0, sx, sy, 12 + age * 0.4);
      smoke.addColorStop(0, '#f0dbff'); smoke.addColorStop(0.5, '#aea0c4aa'); smoke.addColorStop(1, '#7a689800');
      c.fillStyle = smoke; c.beginPath(); c.arc(sx, sy, 12 + age * 0.4, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  private burstLightning(frame: number, remaining: number): void {
    const c = this.ctx;
    const fade = remaining / 12;
    c.save();
    c.fillStyle = `rgba(255, 233, 177, ${remaining > 9 ? 0.12 : 0.025 * fade})`;
    c.fillRect(0, 0, FIELD.w, FIELD.h);
    c.globalAlpha = fade * 0.7;
    c.strokeStyle = '#e5c0ff'; c.shadowColor = '#cc99ff'; c.shadowBlur = 14;
    const seed = Math.floor((frame + remaining) / 18);
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5 + seed * 0.37;
      c.beginPath(); c.moveTo(192, 224);
      for (let j = 1; j <= 8; j++) {
        const distance = j * 55;
        const bend = Math.sin(seed * 3.1 + i * 7 + j * 4.9) * 22;
        const x = 192 + Math.cos(angle) * distance - Math.sin(angle) * bend;
        const y = 224 + Math.sin(angle) * distance + Math.cos(angle) * bend;
        c.lineTo(x, y);
        if (j === 3 || j === 5) {
          c.lineTo(x + Math.cos(angle + 0.5) * 36, y + Math.sin(angle + 0.5) * 36); c.moveTo(x, y);
        }
      }
      c.lineWidth = 3; c.stroke();
      c.strokeStyle = '#fff4d2'; c.lineWidth = 1; c.stroke(); c.strokeStyle = '#e5c0ff';
    }
    c.restore();
  }

  private owl(enemy: Pick<Enemy, 'x' | 'y' | 'color'>, frame: number): void {
    const c = this.ctx; c.save(); c.translate(enemy.x, enemy.y);
    c.fillStyle = ['#9ab1ec', '#e0a6d5', '#e6ca95'][enemy.color];
    c.beginPath(); c.ellipse(0, 0, 12, 14, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(-9, -8); c.lineTo(-12, -17); c.lineTo(-3, -12); c.moveTo(9, -8); c.lineTo(12, -17); c.lineTo(3, -12); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-4, -3, 4, 0, Math.PI * 2); c.arc(4, -3, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#222037'; c.beginPath(); c.arc(-3, -3, 1.7, 0, Math.PI * 2); c.arc(3, -3, 1.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f6b95d'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-3, 4); c.lineTo(3, 4); c.fill();
    c.strokeStyle = '#d7ddff'; c.lineWidth = 3;
    const wing = Math.floor(frame / 10) % 2 ? 6 : -3;
    c.beginPath(); c.moveTo(-10, 2); c.lineTo(-18, wing); c.moveTo(10, 2); c.lineTo(18, wing); c.stroke(); c.restore();
  }

  private clone(clone: Clone, frame: number): void {
    const c = this.ctx; c.save(); c.translate(clone.x, clone.y); c.rotate(frame * 0.045);
    c.fillStyle = '#fff2bb'; c.shadowColor = '#f5db8a'; c.shadowBlur = 11;
    c.beginPath(); c.moveTo(0, -8); c.lineTo(7, 0); c.lineTo(0, 8); c.lineTo(-7, 0); c.closePath(); c.fill();
    c.restore();
  }

  private bullet(b: Bullet): void {
    if (b.motion === 'bookshelf') {
      const c = this.ctx;
      const left = b.targetX > 0 ? 0 : b.x;
      const width = b.targetX > 0 ? Math.max(0, b.x) : Math.max(0, FIELD.w - b.x);
      c.save(); c.globalAlpha = b.delay > 0 ? 0.45 : 0.95;
      c.fillStyle = '#9d8acb'; c.strokeStyle = '#eee1ff';
      c.fillRect(left, b.y - 9, width, 18);
      c.strokeRect(left, b.y - 9, width, 18);
      c.fillStyle = '#eee1ff'; c.fillRect(b.x - 4, b.y - 12, 5, 24); c.restore();
      return;
    }
    if (b.motion === 'codexBox') {
      const c = this.ctx;
      c.save(); c.fillStyle = '#e7d2a5'; c.strokeStyle = '#fff4d3'; c.lineWidth = 2;
      c.fillRect(b.x - 17, b.y - 17, 34, 34); c.strokeRect(b.x - 17, b.y - 17, 34, 34);
      c.beginPath(); c.moveTo(b.x - 17, b.y - 17); c.lineTo(b.x + 17, b.y + 17); c.moveTo(b.x + 17, b.y - 17); c.lineTo(b.x - 17, b.y + 17); c.stroke();
      c.restore();
      this.text(String(Math.max(1, Math.ceil(b.delay / (b.gridRow / 3)))), b.x, b.y + 4, 16, '#372339', 'center');
      return;
    }
    if (b.motion === 'vanish' && b.age > b.fadeAt - 20 && b.age % 8 < 4) return;
    if (b.motion === 'trim' && b.age > b.fadeAt - 36 && b.age % 8 < 4) return;
    if (b.motion === 'citation' && b.gridRow < 2 && b.age >= b.releaseAt - 24 && b.age % 8 < 4) return;
    const variant = b.motion === 'typographyRain' ? 1 + b.gridColumn * RAIN_FONTS.length + b.gridRow
      : b.kind === 'star' ? Math.floor(((b.age * 0.045) % (Math.PI * 2)) / (Math.PI * 2) * 16) : 0;
    const sprite = this.sprites.get(`${b.kind}-${b.color}-${variant}`);
    if (sprite) {
      const c = this.ctx;
      if (b.delay > 0) c.globalAlpha = 0.36;
      else if (b.motion === 'interviewRing' && b.gridRow === 0) c.globalAlpha = 0.55;
      if (b.motion === 'typographyRain') {
        const size = b.radius / 3;
        c.save(); c.translate(b.x, b.y); c.rotate(b.rotation);
        c.drawImage(sprite, -14 * size, -14 * size, 28 * size, 28 * size); c.restore();
      } else if (b.motion === 'jinraiSakura') {
        c.save(); c.translate(b.x, b.y); c.rotate(b.rotation);
        c.drawImage(sprite, -14, -14, 28, 28); c.restore();
      } else c.drawImage(sprite, b.x - 14, b.y - 14, 28, 28);
      if (b.delay > 0 || b.motion === 'interviewRing') c.globalAlpha = 1;
      if (b.motion === 'vanish') this.text('×', b.x, b.y + 1, 13, '#fff2b8', 'center');
    }
  }

  private stageTelegraphs(game: Game): void {
    const pattern = game.phase?.pattern === 'neoEncore' ? [undefined, 'keyRain', 'keyInvite', 'dotfiles'][game.encoreCount] : claudineScene(game);
    if (!pattern) return;
    const c = this.ctx;
    const t = game.phaseFrame - 105;
    const lite = game.phase?.pattern === 'final';
    const sceneTime = lite ? t % 600 : t;
    c.save();
    if (pattern === 'keyRain') {
      c.strokeStyle = '#f5db8a66'; c.lineWidth = 1;
      for (let row = 0; row < 3; row++) for (let col = 0; col < 10; col++) c.strokeRect(25 + col * 35, 47 + row * 25, 27, 19);
    }
    let circleShown = false;
    if (pattern === 'keyInvite') game.bullets.forEach((b) => {
      if (circleShown || b.motion !== 'keyCircle' || b.delay <= 0) return;
      c.strokeStyle = '#80dfff66'; c.lineWidth = 2;
      c.beginPath(); c.arc(b.targetX, b.targetY, 82, 0, Math.PI * 2); c.stroke();
      circleShown = true;
    });
    const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
    if (pattern === 'dotfiles' && t >= -[120, 95, 75, 60][level]) {
      const bogTime = game.phase?.pattern === 'neoEncore' ? encoreBogTime(game) : t;
      for (const [x, y, r] of bogs(bogTime)) {
        c.fillStyle = '#8955bb33'; c.strokeStyle = bogTime < 0 || Math.floor(bogTime / 16) % 2 ? '#be8affaa' : '#be8aff44';
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
      }
    }
    if (pattern === 'enter' && t >= 0) {
      const period = [175, 155, 140, 125][level];
      const step = t % period;
      if (step > period - [70, 58, 48, 38][level]) this.text('↵', 364, 112 + Math.floor(t / period) % 3 * 42, 22, '#fff0a0', 'center');
    }
    if (pattern === 'bookshelf') game.bullets.forEach((b) => {
      if (b.motion !== 'bookshelf' || b.delay <= 0) return;
      c.strokeStyle = '#d5aafa99'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(b.targetX > 0 ? 0 : FIELD.w, b.y); c.lineTo(b.targetX > 0 ? 154 : 230, b.y); c.stroke();
    });
    if (pattern === 'grid') {
      c.strokeStyle = '#f5dbac77'; c.lineWidth = 1;
      const layout = gridLayoutAt(sceneTime, level, lite);
      this.text(`${GRID_NAMES[layout]} ${GRID_DIRECTIONS[layout]}`, 12, 52, 11, '#fff0c6');
      const local = Math.max(0, sceneTime) % (lite ? GRID_REPLAY_PERIOD : GRID_PERIOD[level]);
      if (local < [90, 70, 55, 42][level] + (lite ? 18 : 0)) for (let row = 0; row < gridRows(level, lite); row++) for (let col = 0; col < GRID_COLUMNS[layout]; col++) {
        const [x, y] = gridPoint(layout, row, col, level, lite);
        c.strokeRect(x - 12, y - 10, 24, 20);
      }
      game.bullets.forEach((b) => {
        if (b.motion !== 'layoutGrid' || b.releaseAt - b.age > 24) return;
        const [vx, vy] = gridVelocity(layout, level, lite);
        const angle = Math.atan2(vy, vx);
        c.strokeStyle = '#fff2caaa';
        c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x + Math.cos(angle) * 24, b.y + Math.sin(angle) * 24); c.stroke();
      });
    }
    if (pattern === 'type') {
      const weather = weatherAt(sceneTime, lite);
      const period = lite ? WEATHER_REPLAY_PERIOD : WEATHER_PERIOD;
      const local = Math.max(0, sceneTime) % period;
      const next = (weather + 1) % WEATHER_NAMES.length;
      this.text(local >= period - 45 ? `${WEATHER_NAMES[weather]} → ${WEATHER_NAMES[next]}` : WEATHER_NAMES[weather], 12, 52, 11, '#fff0c6');
      if (weather === 2) {
        c.strokeStyle = '#ffe4bf55'; c.lineWidth = 1;
        const direction = Math.floor(Math.max(0, sceneTime) / (period * 3)) % 2 ? -1 : 1;
        for (let i = 0; i < 7; i++) {
          const x = (game.frame * direction * 2 + i * 67 + 10000) % 450 - 30;
          c.beginPath(); c.moveTo(x, 70 + i * 44); c.lineTo(x + direction * 65, 98 + i * 44); c.stroke();
        }
      }
    }
    if (pattern === 'complement') {
      const local = game.phase?.pattern === 'final' ? t % 600 : t;
      const boundary = complementBoundary(local);
      c.fillStyle = '#378beb29'; c.fillRect(0, 0, boundary, FIELD.h);
      c.fillStyle = '#ff9a3a29'; c.fillRect(boundary, 0, FIELD.w - boundary, FIELD.h);
      c.strokeStyle = '#fff1ca99'; c.setLineDash([7, 7]); c.beginPath(); c.moveTo(boundary, 0); c.lineTo(boundary, FIELD.h); c.stroke(); c.setLineDash([]);
    }
    if (pattern === 'whiteSpace') {
      const local = game.phase?.pattern === 'final' ? t % 600 : t;
      const [x, y, r] = whiteSpaceCircle(local);
      c.fillStyle = '#fff7d22a'; c.strokeStyle = '#fff7d2cc'; c.lineWidth = 2;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
      this.text('余白', x, y + 4, 14, '#fff6da', 'center');
    }
    if (pattern === 'bow' && t >= 3000 && FAREWELL_RELEASE[level].some((release) => release > t)) {
      const [x, y] = game.bossXY;
      c.strokeStyle = '#ffe4ee99'; c.fillStyle = '#ffa8d319'; c.lineWidth = 2;
      c.beginPath();
      for (let i = 0; i <= 72; i++) {
        const angle = i * Math.PI * 2 / 72;
        const radius = flowerRadius(angle);
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath(); c.fill(); c.stroke();
    }
    if (pattern === 'tags' && t >= -[100, 80, 65, 50][level]) {
      tags(t).forEach(([x, y], i) => { this.magic(x, y, game.frame, ['#b286f5', '#75d7ff', '#ffe08e'][i], 29, 0.5); });
    }
    if (pattern === 'sweep' && t >= 0) {
      const step = sweepStep(game.phaseFrame, level);
      const [x, y] = game.bossXY;
      if (step < SWEEP_MOVE) {
        const [tx, ty] = sweepTarget(Math.floor(t / SWEEP_PERIOD[level]));
        this.magic(tx, ty, game.frame, '#c79aff', 34, 0.3);
      } else if (step < SWEEP_MOVE + SWEEP_CHARGE[level]) {
        const progress = (step - SWEEP_MOVE) / SWEEP_CHARGE[level];
        c.fillStyle = '#ead5ff'; c.globalAlpha = 0.45 + progress * 0.4;
        for (let i = 0; i < 16; i++) {
          const angle = i * Math.PI / 8 + game.frame * 0.018;
          const radius = 90 - (progress * 90 + i * 11) % 75;
          c.beginPath(); c.arc(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 1.8, 0, Math.PI * 2); c.fill();
        }
      }
      for (const shot of SWEEP_SHOTS) {
        const flash = step - SWEEP_MOVE - SWEEP_CHARGE[level] - shot;
        if (flash < 0 || flash >= 24) continue;
        const strength = 1 - flash / 24;
        c.globalAlpha = strength * 0.09;
        c.fillStyle = '#eacaff'; c.fillRect(0, 0, FIELD.w, FIELD.h);
        c.globalAlpha = strength * 0.6; c.strokeStyle = '#f8eaff'; c.lineWidth = 2;
        c.beginPath(); c.arc(x, y, 18 + flash * 9, 0, Math.PI * 2); c.stroke();
        for (let i = 0; i < 16; i++) {
          const angle = i * Math.PI / 8 + shot * 0.015;
          const inner = 24 + flash * 5; const outer = inner + 28 * strength;
          c.beginPath(); c.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
          c.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer); c.stroke();
        }
      }
    }
    c.restore();
  }

  private minervaTelegraphs(game: Game): void {
    if (game.boss !== 'minerva' || game.midboss || !game.phase?.spell) return;
    const pattern = game.phase.pattern;
    const t = game.phaseFrame - 105;
    const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(game.difficulty);
    const warning = MINERVA_WARNING[level];
    const c = this.ctx;
    c.save();
    if (pattern === 'sevenRings') {
      game.bullets.forEach((b) => {
        if (b.motion !== 'minervaRing') return;
        if (b.delay <= 0 && b.releaseAt - b.age <= 30) {
          c.strokeStyle = '#fff1b8bb'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x, b.y + 28); c.stroke();
          return;
        }
        if (b.delay <= 0) return;
        c.strokeStyle = '#ffe2a488'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(b.x, b.y);
        c.lineTo(b.x + b.vx * 24, b.y + b.vy * 24); c.stroke();
      });
    }
    if (pattern === 'question') game.bullets.forEach((b) => {
      if (b.motion !== 'question' || b.age < 41 || b.age >= b.releaseAt) return;
      c.strokeStyle = '#f9dfad66'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(game.px, game.py); c.stroke();
    });
    if (pattern === 'hypothesis' && t >= 0) {
      const period = HYPOTHESIS_PERIOD[level];
      const local = t % period;
      if (local < warning) {
        const real = hypothesisSide(Math.floor(t / period));
        for (const side of [0, 1]) {
          c.globalAlpha = hypothesisBrightness(level, side === real, local);
          c.strokeStyle = side === 0 ? '#87e7ff' : '#ffc6e1'; c.lineWidth = 2;
          c.setLineDash([7, 6]);
          for (let i = 0; i < HYPOTHESIS_COLUMNS[level]; i++) {
            const x = hypothesisX(side, i, level, Math.floor(t / period));
            c.beginPath(); c.moveTo(x, 24); c.lineTo(x, FIELD.h); c.stroke();
          }
          c.setLineDash([]);
        }
        c.globalAlpha = 1;
      }
    }
    if (pattern === 'owlEye' && t >= 0) {
      const x = eyeX(t);
      c.fillStyle = '#ffe7a022'; c.fillRect(x - 30, 36, 60, FIELD.h - 36);
      c.strokeStyle = '#fff1baaa'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, 36); c.lineTo(x, FIELD.h); c.stroke();
      c.fillStyle = '#fbe9b9'; c.beginPath(); c.ellipse(x, 29, 28, 13, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#382039'; c.beginPath(); c.arc(x, 29, 8, 0, Math.PI * 2); c.fill();
    }
    if (pattern === 'recall') game.bullets.forEach((b) => {
      if (b.motion !== 'recall' || b.age < b.gridRow - warning * 0.55 || b.age >= b.gridRow) return;
      c.strokeStyle = '#fff0bf88'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.targetX, b.targetY); c.stroke();
    });
    if (pattern === 'citation') game.bullets.forEach((b) => {
      if (b.motion !== 'citation' || b.gridRow >= 2 || b.releaseAt - b.age > warning || b.age >= b.releaseAt) return;
      c.strokeStyle = '#ffe4ab88'; c.lineWidth = 1;
      for (const side of [-1, 1]) {
        c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x + side * 19, b.y + 32); c.stroke();
      }
    });
    if (pattern === 'interview' && t >= 0) {
      const [x, y] = game.bossXY;
      c.strokeStyle = '#ffe2bd88'; c.lineWidth = 2; c.setLineDash([6, 7]);
      c.beginPath(); c.arc(x, y, 45, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      c.strokeStyle = '#f9d5e077'; c.beginPath(); c.moveTo(x, y); c.lineTo(game.px, game.py); c.stroke();
    }
    if (pattern === 'owlDawn') {
      const period = DAWN_PERIOD[level];
      const next = t < 0 ? 0 : Math.ceil((t + 1) / period) * period;
      if (next - t <= warning) {
        const side = Math.floor(next / period) % 2 ? -1 : 1;
        const from = side > 0 ? 0 : FIELD.w;
        const lane = dawnLane(Math.floor(next / period));
        c.strokeStyle = '#ffe7b388'; c.lineWidth = 2; c.setLineDash([8, 7]);
        c.beginPath(); c.moveTo(from, lane); c.lineTo(from + side * 100, lane + 36); c.stroke(); c.setLineDash([]);
      }
    }
    c.restore();
  }

  private item(item: Item): void {
    const c = this.ctx;
    const colors: Record<Item['kind'], string> = { small: '#f47c86', large: '#fb354b', point: '#59d9fb', bomb: '#78e4a6', life: '#ff92df' };
    c.save(); c.translate(item.x, item.y); c.fillStyle = colors[item.kind]; c.shadowColor = c.fillStyle; c.shadowBlur = 9;
    c.beginPath(); c.arc(0, 0, item.kind === 'large' || item.kind === 'life' ? 7 : 5, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0; this.text(({ small: 'P', large: 'P', point: '点', bomb: 'B', life: '★' })[item.kind], 0, 0, 8, '#fff', 'center'); c.restore();
  }

  private player(game: Game): void {
    const c = this.ctx;
    if (game.invulnFrames > 0 && Math.floor(game.frame / 4) % 2) return;
    this.fieldCharacter(game, game.player, game.px, game.py + Math.sin(game.frame * 0.06) * 1.5, 40, game.playerDx * 0.024);
    const options = Math.floor(game.power);
    for (let i = 0; i < options; i++) {
      const a = game.frame * 0.04 + i * Math.PI * 2 / options;
      c.fillStyle = '#d9eeff'; c.shadowColor = '#9de8ff'; c.shadowBlur = 8;
      c.beginPath(); c.arc(game.px + Math.cos(a) * 21, game.py + Math.sin(a) * 14, 3.4, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    }
  }

  // 動きの絵が読み込めていなければ、ボスの元絵へ戻す
  private readySprite(game: Game, id: string): string {
    const sprite = game.images[`${id}-sprite`];
    return sprite?.complete && sprite.naturalWidth > 0 ? id : (game.boss ?? id);
  }

  private fieldCharacter(game: Game, id: string, x: number, y: number, height: number, tilt: number, alpha = 1): void {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.rotate(tilt);
    const sprite = game.images[`${id}-sprite`];
    if (sprite?.complete && sprite.naturalWidth > 0) {
      this.image(game, `${id}-sprite`, -height / 2, -height * 0.7, height, height, alpha);
    } else {
      this.image(game, `${id}-stand`, -height / 2, -height * 0.7, height, height, alpha);
    }
    c.restore();
  }

  private focusMarker(game: Game): void {
    if (!game.keys.has('ShiftLeft') && !game.keys.has('ShiftRight')) return;
    const c = this.ctx;
    c.save(); c.translate(game.px, game.py);
    c.rotate(game.frame * 0.012);
    c.lineWidth = 1.2;
    c.strokeStyle = '#f4eaf099';
    for (let i = 0; i < 4; i++) {
      const start = i * Math.PI / 2 + 0.12;
      c.beginPath(); c.arc(0, 0, 15, start, start + Math.PI / 3); c.stroke();
    }
    c.restore();
    c.save(); c.translate(game.px, game.py);
    c.shadowColor = '#ff274f'; c.shadowBlur = 5;
    c.fillStyle = '#c8284a'; c.beginPath(); c.arc(0, 0, 4.2, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, 2.6, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  private bombEffect(game: Game): void {
    const c = this.ctx; c.save(); c.globalAlpha = 0.6;
    c.strokeStyle = '#a3e8ff'; c.lineWidth = 2;
    for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(game.px, game.py, ((150 - game.bombFrames) * 2 + i * 25) % 290, 0, Math.PI * 2); c.stroke(); }
    c.restore();
  }

  private cutin(game: Game): void {
    const c = this.ctx;
    const age = 100 - game.cutin;
    const enter = 1 - (1 - Math.min(1, age / 18)) ** 4;
    const leave = Math.max(0, (age - 72) / 28);
    const alpha = Math.min(1, age / 6, game.cutin / 20);
    const accent = STAGES[game.stage - 1].colors[2];
    c.save(); c.globalAlpha = alpha;
    c.beginPath(); c.rect(0, 32, FIELD.w, FIELD.h - 32); c.clip();
    c.fillStyle = '#050714aa'; c.fillRect(0, 32, FIELD.w, FIELD.h - 32);
    // 短い突入、読める静止、退場。攻撃開始の105フレーム前に消える。
    c.translate((1 - enter) * 330 - leave * 400, 0);
    const band = c.createLinearGradient(0, 80, FIELD.w, 360);
    band.addColorStop(0, '#070b20'); band.addColorStop(0.55, `${accent}cc`); band.addColorStop(1, '#10152a');
    c.fillStyle = band;
    c.beginPath(); c.moveTo(-80, 133); c.lineTo(440, 48); c.lineTo(460, 344); c.lineTo(-80, 421); c.closePath(); c.fill();
    c.strokeStyle = accent; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-80, 133); c.lineTo(440, 48); c.moveTo(-80, 421); c.lineTo(460, 344); c.stroke();
    for (let i = 0; i < 13; i++) {
      const y = 105 + i * 21;
      const offset = (age * (8 + i % 4 * 3) + i * 63) % 520 - 100;
      c.strokeStyle = i % 3 ? `${accent}88` : '#ffffffcc'; c.lineWidth = i % 4 === 0 ? 2 : 0.7;
      c.beginPath(); c.moveTo(offset, y); c.lineTo(offset + 80 + i % 3 * 40, y - 17); c.stroke();
    }
    this.magic(250, 216, age * 4, accent, 100 + age * 0.3, 0.65 * alpha);
    c.save(); c.translate((1 - enter) * 140, 0);
    if (game.boss === 'etokichi') this.image(game, 'etokichi-stand', 65, 65, 315, 315, alpha);
    else this.image(game, `${game.boss}-stand`, 46, 45, 360, 420, alpha);
    c.restore();
    c.fillStyle = '#070b20dd'; c.fillRect(0, 297, FIELD.w, 88);
    c.fillStyle = accent; c.fillRect(0, 297, 5, 88);
    this.text(game.phase?.kind === 'survival' ? '最後の手合わせ / 耐久' : '必殺技 / 発動', 17, 313, 10, accent);
    c.shadowColor = '#040616'; c.shadowBlur = 8;
    this.text(NAMES[game.boss!], 17, 339, 32, '#fff5db');
    c.shadowBlur = 0;
    const name = game.phase?.name ?? '';
    const size = Math.min(18, 342 / Math.max(1, name.length));
    this.text(name, 17, 369, size, '#fff');
    if (age < 24) {
      c.globalAlpha = alpha * (1 - age / 24);
      c.strokeStyle = '#fff7dc'; c.lineWidth = 6 * (1 - age / 24);
      c.beginPath(); c.arc(250, 210, 30 + age * 15, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  }

  private drawPanel(game: Game): void {
    const c = this.ctx;
    this.card(426, 16, 199, 448, '#141d2a', '#4a5c5c');
    this.uiText('owlery', 441, 37, 11, '#9ebcad');
    this.uiText('みみこの冒険ノート', 441, 57, 15, '#f3e5c4');
    for (let i = 0; i < STAGES.length; i++) {
      const x = 449 + i * 36; const current = i === game.stage - 1;
      if (i < STAGES.length - 1) {
        c.strokeStyle = i < game.stage - 1 ? '#90b3a2' : '#36494d';
        c.beginPath(); c.moveTo(x + 8, 86); c.lineTo(x + 28, 86); c.stroke();
      }
      c.fillStyle = current ? '#e8d49f' : i < game.stage - 1 ? '#739a8b' : '#263941';
      c.beginPath(); c.arc(x, 86, current ? 9 : 6, 0, Math.PI * 2); c.fill();
      this.uiText(String(i + 1), x, 86, 9, current ? '#263c35' : '#c4d4c9', 'center');
    }
    const room = STAGES[game.stage - 1].title.split(' 〜 ')[0];
    this.uiText(room, 525, 110, 11, '#a9c5b7', 'center');
    this.card(437, 129, 177, 84, '#202d37', '#3a4f54');
    this.uiText('今回のスコア', 449, 146, 10, '#afc7bd');
    this.uiText(game.score.toLocaleString(), 602, 172, 25, '#fff1ce', 'right', 153);
    this.uiText('最高記録', 449, 199, 9, '#a0adad');
    this.uiText(game.highScore.toLocaleString(), 602, 199, 11, '#c2d4c9', 'right', 105);
    this.card(437, 223, 85, 48, '#242a39', '#414756');
    this.card(529, 223, 85, 48, '#203532', '#3d5950');
    this.uiText('残り回数', 449, 237, 10, '#d2c5d8');
    this.uiText(String(Math.max(0, game.lives + 1)), 510, 257, 20, '#ead4e1', 'right');
    this.uiText('ボム', 541, 237, 10, '#b4d9c5');
    this.uiText(String(game.bombs), 602, 257, 20, '#cfefd8', 'right');
    this.uiText('ショット強度', 442, 291, 11, '#b8c8c3');
    this.uiText(`${game.power.toFixed(2)} / 4`, 607, 291, 11, '#f1e7cc', 'right');
    for (let i = 0; i < 4; i++) {
      c.fillStyle = '#2a3d42'; c.fillRect(442 + i * 42, 305, 37, 5);
      c.fillStyle = '#b8d3b0'; c.fillRect(442 + i * 42, 305, 37 * Math.max(0, Math.min(1, game.power - i)), 5);
    }
    this.uiText('かすり回数', 442, 332, 11, '#a8bfbb');
    this.uiText(game.graze.toLocaleString(), 607, 332, 13, '#eff0dc', 'right');
    this.uiText('点アイテム最大値', 442, 354, 10, '#a8bfbb');
    this.uiText(game.point.toLocaleString(), 607, 354, 12, '#eff0dc', 'right');
    c.strokeStyle = '#405957'; c.beginPath(); c.moveTo(441, 374); c.lineTo(610, 374); c.stroke();
    this.image(game, `${game.player}-face`, 438, 382, 62, 62);
    this.uiText('書いて残す。', 506, 402, 12, '#eadbb9');
    this.uiText(`集めた記録 ${game.collectedRecords.length} / 5`, 506, 424, 10, '#a9bfb8');
    this.uiText('みんなのことも。', 506, 440, 10, '#a9bfb8');
  }

  private drawDialogue(game: Game): void {
    const c = this.ctx;
    const line = game.lines[game.lineIndex]; if (!line) return;
    const opponent = game.boss!;
    c.fillStyle = '#080915aa'; c.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
    this.image(game, `${game.player}-stand`, 30, 135, 168, 250, line.who === game.player ? 0.9 : 0.34);
    if (opponent === 'etokichi') this.image(game, 'etokichi-stand', 192, 93, 220, 220, line.who === opponent ? 0.95 : 0.34);
    else this.image(game, `${opponent}-stand`, 242, 87, 170, 275, line.who === opponent ? 0.95 : 0.34);
    c.fillStyle = '#100f2ee8'; c.fillRect(39, 330, 369, 110);
    c.strokeStyle = '#c4a8e9'; c.strokeRect(39, 330, 369, 110);
    this.text(line.who === game.player ? PLAYER_NAMES[game.player] : NAMES[opponent], 54, 350, 16, '#fbe8b9');
    this.wrapText(line.text, 53, 379, 340, 16);
    this.text('Z ▶   Ctrl 早送り', 397, 429, 10, '#aaa5c4', 'right');
  }

  private wrapText(value: string, x: number, y: number, width: number, size: number): void {
    const c = this.ctx;
    c.font = `${size}px "Hiragino Mincho ProN", "Yu Mincho", serif`;
    wrapDialogue(value, width, (text) => c.measureText(text).width).forEach((line, row) => {
      this.text(line, x, y + row * 22, size);
    });
  }

  private drawOverlay(game: Game): void {
    const c = this.ctx; c.fillStyle = '#080615cf'; c.fillRect(32, 16, 384, 448);
    if (game.scene === 'clear') {
      this.text('頁を、書き留めた。', 224, 115, 27, '#ffebc2', 'center');
      const record = RECORDS[game.stage - 1];
      this.card(56, 162, 336, 145, '#1e2837', '#64766a');
      this.uiText(record.title, 72, 184, 15, '#eadbb9', 'left', 300);
      record.lines.forEach((line, i) => { this.uiText(line, 72, 224 + i * 25, 12, '#d8ded4', 'left', 300); });
      this.uiText(`クリアボーナス  ${game.clearBonus.toLocaleString()}`, 224, 345, 14, '#fff', 'center');
      this.uiText(game.practice ? 'Z  タイトルへ' : game.stage === 5 ? 'Z  朝の約束へ' : 'Z  次の階へ', 224, 399, 13, '#e0d4f8', 'center');
    }
    if (game.scene === 'pause') { this.text('PAUSE', 224, 139, 32, '#ffebc2', 'center'); this.overlayMenu(['再開', 'タイトルへ戻る', 'やり直し'], game.menu); }
    if (game.scene === 'gameover') { this.text('GAME OVER', 224, 139, 32, '#ffb9c8', 'center'); this.overlayMenu(['コンティニュー', 'タイトルへ戻る'], game.menu); }
  }

  private overlayMenu(entries: string[], selected: number): void {
    entries.forEach((entry, i) => { this.text(`${selected === i ? '◆  ' : '    '}${entry}`, 224, 222 + i * 39, 18, selected === i ? '#ffebc2' : '#aea8c5', 'center'); });
  }

  private drawEnding(game: Game): void {
    const c = this.ctx; const gradient = c.createLinearGradient(0, 0, 640, 480);
    gradient.addColorStop(0, '#282644'); gradient.addColorStop(1, '#e2a47e'); c.fillStyle = gradient; c.fillRect(0, 0, 640, 480);
    this.stars(game.frame, 640, 480, 0.2);
    if (game.scene === 'ending') {
      this.image(game, `${game.player}-stand`, 30, 58, 230, 365, 0.85);
      this.text('ENDING', 415, 73, 31, '#fff1cb', 'center');
      game.endingLines.forEach((line, i) => { this.text(line, 266, 146 + i * 44, 14, '#fff'); });
      this.text('Z  スタッフロールへ', 584, 451, 12, '#f8e9d9', 'right');
    } else {
      this.text(GAME_TITLE, 320, 84, 36, '#fff1cb', 'center');
      this.uiText('弾幕シューティング / owlery', 320, 126, 12, '#f1dcc9', 'center');
      ['企画・仕様  チャッピー', '制作・調整  迅雷 / Codex', 'キャラクター  owleryのみんな', 'エトキチ  エトキチの大冒険より', '遊んでくれたあなたへ、ありがとう。'].forEach((line, i) => { this.uiText(line, 320, 187 + i * 40, 16, '#fff', 'center'); });
      this.text('Z  タイトルへ', 320, 449, 12, '#f8e9d9', 'center');
    }
  }
}
