import { AudioBank } from './audio';
import { type BgmCue, BgmPlayer } from './bgm';
import { CAST_GAP, MOTION_SPRITES } from './boss-motion';
import { patternPosition } from './boss-movement';
import { dialogue, ENDINGS, type Line, midDialogue } from './dialogue';
import { CREDITS_HOLD_FRAMES, CREDITS_ROLL_FRAMES, ENDING_EXIT_FRAMES, ENDING_LINE_FADE, ENDING_LINE_GAP, ENDING_READ_FRAMES } from './ending';
import { ENEMY_ROOMS, enemyFireFrames } from './enemy-design';
import { ENDING_MOVIES, MOVIES, type MovieName, MoviePlayer } from './movies';
import { obsidiaPosition } from './obsidia-movement';
import { emitBossNormal } from './patterns/boss-normal';
import { emitChappy, updateChappySource } from './patterns/chappy';
import { claudineScene, complementBoundary, emitClaudine, whiteSpaceCircle } from './patterns/claudine';
import { reflectEnterShot } from './patterns/enter-reflect';
import { emitEtokichi, emitGalaxyFlash, type GalaxyFlash, updateGalaxyFlash } from './patterns/etokichi';
import { emitEtokichiDawn } from './patterns/etokichi-dawn';
import { burstPosition, burstVisibility, DASH_ATTACK, DASH_CHARGE_START, DASH_CHARGED, DASH_CUTIN, dashBurstStep, dashPosition, emitJinraiPattern, updateJinraiHazards } from './patterns/jinrai';
import { jinraiCloneScene } from './patterns/jinrai-clone';
import { KISS_FADE, updateJinraiHeart } from './patterns/jinrai-kiss';
import { type Thunderbolt, type Thunderstorm, thunderPosition } from './patterns/jinrai-thunder';
import { dawnPosition, emitMinerva, eyeX, interviewPosition } from './patterns/minerva';
import { updateStarFlightSource } from './patterns/minerva-flight';
import { gravityScene } from './patterns/minerva-inquiry';
import { REPRISES, type Reprise, repriseLocal, repriseView } from './patterns/minerva-reprise';
import { type InterviewRing, interviewRingBlocksShot, updateInterviewRings } from './patterns/minerva-ring';
import { MINERVA_OWL_SPRITES, MINERVA_SOLO_SPRITES, reprisePrepare } from './patterns/minerva-summon';
import { emitNeo, inBog, updateVimBullet, type VimAttack } from './patterns/neo';
import { emitNeoEncore, encoreBogTime } from './patterns/neo-encore';
import { emitObsidia, sweepPosition, tags } from './patterns/obsidia';
import { type GraphEdge, type GraphNode, updateObsidiaGraph } from './patterns/obsidia-graph';
import { Pool } from './pool';
import { autoCollect, bulletContact, bulletSpeed, circlesHit, type Difficulty, deathbomb, density, FIELD, type ItemKind, MAX_BOMBS, MAX_POWER, newExtends, type PlayerId, pointValue, safeLoad, safeSave } from './rules';
import { type BossId, midPhases, NAMES, type Phase, STAGES } from './stages';
import { readRecords } from './story';

export type Scene = 'title' | 'difficulty' | 'player' | 'practice' | 'option' | 'help' | 'notebook' | 'stage' | 'arrival' | 'transition' | 'dialogue' | 'gift' | 'departure' | 'clear' | 'pause' | 'gameover' | 'movie' | 'ending' | 'credits';
type AfterBossMovie = 'jinrai-gift' | 'minerva-finale';
export interface Bullet { active: boolean; x: number; y: number; vx: number; vy: number; radius: number; kind: 'orb' | 'needle' | 'petal' | 'star' | 'heart' | 'glyph' | 'keycap'; keyLabel?: string; color: number; grazed: boolean; age: number; split: boolean; delay: number; fadeAt: number; motion: 'normal' | 'recall' | 'wing' | 'minervaRing' | 'eyeFreeze' | 'starOwl' | 'starTrail' | 'jinraiHeart' | 'jinraiHold' | 'jinraiSpark' | 'jinraiSakura' | 'etoileOrbit' | 'etoileFall' | 'etokichiRing' | 'keyDrop' | 'vim' | 'enterLine' | 'bookshelf' | 'vanish' | 'tagPull' | 'sweepRadial' | 'codexBox' | 'chappyBloom' | 'trim' | 'gridSnap' | 'layoutGrid' | 'typographyRain' | 'complement' | 'whiteSpace' | 'farewellRose' | 'farewellLance'; targetX: number; targetY: number; gridColumn: number; gridRow: number; dashWave: number; dashOrder: number; releaseAt: number; sway: number; swayRate: number; swayPhase: number; rotation: number; spin: number; launchSoundPending: boolean; }
export interface JinraiLaser { x: number; y: number; angle: number; age: number; warning: number; life: number; speed: number; }
export interface Shot { active: boolean; x: number; y: number; vx: number; vy: number; damage: number; radius: number; homing: boolean; }
export type WaveKind = 'arc' | 'ring' | 'cross' | 'threeWay' | 'return' | 'sweep' | 'pincer' | 'serpent' | 'orbit' | 'chevron';
export interface Enemy { active: boolean; x: number; y: number; vx: number; vy: number; hp: number; age: number; hitFrames: number; color: number; kind: WaveKind; originX: number; originY: number; side: number; slot: number; }
export interface Item { active: boolean; x: number; y: number; vx: number; vy: number; kind: ItemKind; auto: boolean; manual: boolean; gift: boolean; tossed: boolean; launchFrames: number; }
export interface Particle { active: boolean; x: number; y: number; vx: number; vy: number; age: number; life: number; color: string; size: number; }
export interface Clone { active: boolean; x: number; y: number; vx: number; vy: number; age: number; }

const makeBullet = (): Bullet => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 4, kind: 'orb', color: 0, grazed: false, age: 0, split: false, delay: 0, fadeAt: 0, motion: 'normal', targetX: 0, targetY: 0, gridColumn: -1, gridRow: -1, dashWave: -1, dashOrder: -1, releaseAt: 0, sway: 0, swayRate: 0, swayPhase: 0, rotation: 0, spin: 0, launchSoundPending: false });
export const SAKURA_PERIOD = 300;
export const SAKURA_WARNING = [84, 60, 48, 36] as const;
export const SAKURA_GUST = 90;
export const SAKURA_SWIRL = 24;
const makeShot = (): Shot => ({ active: false, x: 0, y: 0, vx: 0, vy: -9, damage: 1, radius: 2, homing: false });
const makeEnemy = (): Enemy => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, hp: 5, age: 0, hitFrames: 0, color: 0, kind: 'return', originX: 0, originY: 0, side: 1, slot: 0 });
const makeItem = (): Item => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, kind: 'point', auto: false, manual: false, gift: false, tossed: false, launchFrames: 0 });
const makeParticle = (): Particle => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 30, color: '#fff', size: 2 });
const makeClone = (): Clone => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0 });
export const PLAYERS: PlayerId[] = ['mimiko'];
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'lunatic'];
export const PLAYER_NAMES: Record<PlayerId, string> = { mimiko: 'みみこ' };

export class Game {
  scene: Scene = 'title';
  resumeScene: Scene = 'stage';
  player: PlayerId = PLAYERS[0];
  difficulty: Difficulty = 'normal';
  stage = 1;
  stageFrame = 0;
  stageIntroFrame = 180;
  arrivalFrame = 0;
  private arrivalFromWhite = false;
  transition?: 'lastboss-in' | 'lastboss-out' | 'lastboss-hold' | 'boss-defeat-flash' | 'boss-defeat-in' | 'boss-defeat-hold' | `${AfterBossMovie}-out`;
  transitionFrame = 0;
  private transitionFadeStart = 0;
  postBoss = false;
  departureFrame = 0;
  private clearReadyFrame = -1;
  private bossDefeatOrigin: [number, number] = [192, 77];
  giftFrame = 0;
  endingFrame = 0;
  private endingReadFrame = 0;
  private endingReadDuration = ENDING_READ_FRAMES;
  private endingRevealed = false;
  creditsFrame = 0;
  movieName?: MovieName;
  readonly movies: MoviePlayer;
  private movieDone?: () => void;
  sceneryDistance = 0;
  midbossElapsedFrames = 0;
  collectionFrames = 0;
  frame = 0;
  menu = 0;
  optionVolume = 50;
  optionBgmVolume = 60;
  px = FIELD.w / 2;
  py = FIELD.h - 50;
  playerDx = 0;
  power = 0;
  awakened = false;
  lives = 2;
  bombs = 3;
  score = 0;
  highScore = 0;
  graze = 0;
  point = 10000;
  invincible = false;
  autoshot = false;
  invulnFrames = 0;
  pendingHit = -1;
  bombFrames = 0;
  bombUsed = false;
  hitDuringSpell = false;
  boss?: BossId;
  midboss = false;
  phaseIndex = -1;
  phase?: Phase;
  phaseFrame = 0;
  minervaFlightPairStart = -1;
  minervaFlightThirdStart = -1;
  minervaInterviewLateStart = -1;
  minervaInterviewNextShot = 105;
  minervaInterviewWave = 0;
  bossCastFrame = -Infinity;
  private bossEntry: [number, number] = [192, 77];
  phaseHp = 0;
  phaseMaxHp = 0;
  private initialPhaseHpRatio?: number;
  encoreCount = 0;
  spellBonus = 0;
  cutin = 0;
  flash = 0;
  message = '';
  messageFrames = 0;
  lines: Line[] = [];
  lineIndex = 0;
  afterDialogue: 'boss' | 'mid' | 'stage' | 'clear' | 'gift' = 'stage';
  clearBonus = 0;
  fps = 60;
  practice = false;
  readonly collectedRecords = safeLoad('owlery-records', [] as number[], readRecords);
  readonly bullets = new Pool(makeBullet, 2600);
  readonly shots = new Pool(makeShot, 500);
  readonly enemies = new Pool(makeEnemy, 80);
  readonly items = new Pool(makeItem, 2600);
  readonly particles = new Pool(makeParticle, 500);
  readonly clones = new Pool(makeClone, 70);
  readonly jinraiLasers: JinraiLaser[] = [];
  readonly jinraiBolts: Thunderbolt[] = [];
  jinraiThunderstorm?: Thunderstorm;
  minervaReprise?: Reprise;
  readonly interviewRings: InterviewRing[] = [];
  readonly graphNodes: GraphNode[] = [];
  readonly graphEdges: GraphEdge[] = [];
  graphFrame = 0;
  galaxyFlash?: GalaxyFlash;
  keyboardWord = '';
  vimAttack?: VimAttack;
  jinraiDashTick = -1;
  jinraiDashDouble = false;
  jinraiDashCrossing = -1;
  jinraiDashY = 115;
  jinraiDashDirection = 1;
  jinraiDashTrails: { x: number; y: number; frame: number; direction: number; wave: number }[] = [];
  jinraiBurstStartFrame = -1;
  jinraiBurstCount = 0;
  jinraiBurstFromX = 192;
  jinraiBurstFromY = 132;
  jinraiBurstFlashUntil = 0;
  jinraiWindDirection = 0;
  readonly audio = new AudioBank();
  readonly bgm: BgmPlayer;
  readonly keys = new Set<string>();
  readonly images: Record<string, HTMLImageElement> = {};
  private readonly pressed = new Set<string>();
  private lastBossShotFrame = -1;
  private readonly params = new URLSearchParams(location.search);
  private unlocked = safeLoad('owlery-unlocked', 1, (s) => Math.max(1, Math.min(STAGES.length, Number(s) || 1)));
  get unlockedStages(): number { return this.unlocked; }

  // 道中の単体テストは題字と暗幕を省略し、waveの時計を直接検証できる。
  constructor(private readonly presentation = true) {
    this.movies = new MoviePlayer(this.params.get('bgm') === '0');
    this.optionVolume = safeLoad('owlery-volume', 50, (s) => Math.max(0, Math.min(100, Number(s) || 0)));
    this.audio.volume = this.optionVolume / 100;
    this.optionBgmVolume = safeLoad('owlery-bgm-volume', 60, (s) => Number.isFinite(Number(s)) ? Math.max(0, Math.min(100, Number(s))) : 60);
    this.movies.setVolume(this.optionBgmVolume);
    this.bgm = new BgmPlayer(this.params.get('bgm') === '0', this.optionBgmVolume);
    for (const id of new Set([...PLAYERS, ...Object.keys(NAMES)])) {
      for (const form of ['face', 'stand']) {
        const image = new Image();
        image.src = `${import.meta.env.BASE_URL}assets/members/${id}-${form}.webp`;
        this.images[`${id}-${form}`] = image;
      }
      const sprite = new Image();
      sprite.src = `${import.meta.env.BASE_URL}assets/sprites/${id}.webp`;
      this.images[`${id}-sprite`] = sprite;
    }
    for (const id of [...MOTION_SPRITES, ...MINERVA_SOLO_SPRITES, ...MINERVA_OWL_SPRITES, 'claudine-finale']) {
      const sprite = new Image();
      sprite.src = `${import.meta.env.BASE_URL}assets/sprites/${id}.webp`;
      this.images[`${id}-sprite`] = sprite;
    }
    const prayerSprite = new Image();
    prayerSprite.src = `${import.meta.env.BASE_URL}assets/sprites/minerva-prayer.webp`;
    this.images['minerva-prayer-sprite'] = prayerSprite;
    const sealSprite = new Image();
    sealSprite.src = `${import.meta.env.BASE_URL}assets/sprites/jinrai-seal.webp`;
    this.images['jinrai-seal-sprite'] = sealSprite;
    const kissSprite = new Image();
    kissSprite.src = `${import.meta.env.BASE_URL}assets/sprites/jinrai-kiss.webp`;
    this.images['jinrai-kiss-sprite'] = kissSprite;
    const sweepSprite = new Image();
    sweepSprite.src = `${import.meta.env.BASE_URL}assets/sprites/obsidia-sweep.webp`;
    this.images['obsidia-sweep-sprite'] = sweepSprite;
    for (const room of ENEMY_ROOMS) {
      const image = new Image();
      image.src = `${import.meta.env.BASE_URL}assets/enemies/${room}.webp`;
      this.images[`enemy-${room}`] = image;
    }
    this.initQuery();
    if (this.scene === 'title') this.movies.preload(['opening']);
    this.syncBgm();
    window.addEventListener('keydown', (event) => {
      this.bgm.unlock();
      this.audio.unlock();
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
      if (!event.repeat && !this.keys.has(event.code)) this.pressed.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.pressed.clear(); });
  }

  private initQuery(): void {
    const p = this.params.get('player');
    const d = this.params.get('difficulty');
    if (PLAYERS.includes(p as PlayerId)) this.player = p as PlayerId;
    if (DIFFICULTIES.includes(d as Difficulty)) this.difficulty = d as Difficulty;
    this.invincible = this.params.get('invincible') === '1';
    this.autoshot = this.params.get('autoshot') === '1';
    const movie = this.params.get('movie') as MovieName;
    if (MOVIES.includes(movie)) {
      if (movie === 'lastboss' || movie === 'minerva-finale') this.stage = 5;
      if (movie === 'jinrai-gift') this.stage = 4;
      if (movie === 'jinrai-gift' || movie === 'minerva-finale') {
        this.postBoss = true;
        this.boss = STAGES[this.stage - 1].boss;
      }
      this.startMovies([movie], () => {
        if (movie === 'opening') this.startStage(1);
        else if (movie === 'lastboss') this.startConversation('minerva', 'before', 'boss', true);
        else if (movie === 'jinrai-gift' || movie === 'minerva-finale') this.startAfterBossConversation();
        else this.startEnding();
      });
      return;
    }
    if (this.params.get('credits') === '1') { this.scene = 'credits'; return; }
    const ending = this.params.get('ending');
    if (PLAYERS.includes(ending as PlayerId)) {
      this.player = ending as PlayerId;
      this.startEnding();
      return;
    }
    const boss = Number(this.params.get('boss'));
    const stage = Number(this.params.get('stage'));
    if (Number.isInteger(boss) && boss >= 1 && boss <= STAGES.length) {
      this.startStage(boss);
      this.initialPhaseHpRatio = this.queryNumber('hp', 0.01, 1, 1);
      this.startBoss(this.params.get('mid') === '1', Math.max(0, Math.floor(Number(this.params.get('phase')) || 0)));
      this.messageFrames = 0;
    } else if (Number.isInteger(stage) && stage >= 1 && stage <= STAGES.length) {
      this.startStage(stage);
      if (this.params.get('from') === 'boss') {
        this.initialPhaseHpRatio = this.queryNumber('hp', 0.01, 1, 1);
        this.stageIntroFrame = 180;
        this.midbossElapsedFrames = midPhases(STAGES[stage - 1].mid, stage).reduce((total, phase) => total + phase.duration * 60, 0);
        this.stageFrame = this.bossAt - 120;
        this.sceneryDistance = this.stageFrame * 1.8 + this.midbossElapsedFrames * 0.65;
      }
    } else if (PLAYERS.includes(p as PlayerId) || DIFFICULTIES.includes(d as Difficulty)) {
      this.startStage(1);
    }
    this.power = this.queryNumber('power', 0, MAX_POWER, this.power);
    this.awakened = this.params.get('maxform') === '1' && this.power >= MAX_POWER;
    this.lives = Math.floor(this.queryNumber('lives', 0, 8, this.lives));
    this.bombs = Math.floor(this.queryNumber('bombs', 0, MAX_BOMBS, this.bombs));
  }

  private queryNumber(key: string, min: number, max: number, fallback: number): number {
    const raw = this.params.get(key);
    const value = Number(raw);
    return raw === null || !Number.isFinite(value) ? fallback : Math.max(min, Math.min(max, value));
  }

  private just(code: string): boolean { return this.pressed.has(code); }
  private held(code: string): boolean { return this.keys.has(code); }
  private accept(): boolean { return this.just('KeyZ') || this.just('Enter'); }

  update(): void {
    if (this.scene !== 'stage') this.audio.stopEnergy();
    this.frame++;
    if (this.flash > 0) this.flash--;
    if (this.messageFrames > 0) this.messageFrames--;
    if (this.cutin > 0) this.cutin--;
    if (this.scene === 'stage') this.updateStage();
    else if (this.scene === 'arrival') this.updateArrival();
    else if (this.scene === 'transition') this.updateTransition();
    else if (this.scene === 'dialogue') this.updateDialogue();
    else if (this.scene === 'gift') this.updateGift();
    else if (this.scene === 'departure') this.updateDeparture();
    else if (this.scene === 'movie') {
      if (this.just('KeyZ') || this.just('KeyX')) {
        if (this.movieName === 'lastboss' || this.movieName === 'jinrai-gift' || this.movieName === 'minerva-finale') {
          if (this.movieName === 'lastboss') this.startLastbossOut();
          else this.startAfterBossOut();
        } else this.finishMovies();
      }
    }
    else this.updateMenu();
    this.syncBgm();
    this.pressed.clear();
  }

  private syncBgm(): void {
    this.movies.setVolume(this.optionBgmVolume);
    if (this.scene === 'title') this.movies.preload(['opening']);
    if (this.scene === 'pause' || this.scene === 'gameover') {
      this.bgm.sync(this.bgm.cue, true, this.bgm.sceneVolumeMultiplier);
      return;
    }
    let cue: BgmCue | null;
    const lastbossQuiet = (this.scene === 'movie' && this.movieName === 'lastboss') || (this.scene === 'transition' && !!this.transition?.startsWith('lastboss'));
    const postBossQuiet = this.postBoss && (this.scene === 'movie' || this.scene === 'transition');
    if (this.scene === 'movie') cue = this.movieName === 'lastboss' ? 'stage-dawn' : this.movieName && this.movies.usesAudio(this.movieName) ? null : this.movieName === 'opening' ? 'stage-gate' : this.movieName === 'jinrai-gift' ? 'boss-jinrai' : this.movieName === 'minerva-finale' ? 'boss-minerva' : 'ending';
    else if (this.scene === 'transition') cue = lastbossQuiet ? 'stage-dawn' : this.postBoss ? `boss-${STAGES[this.stage - 1].boss}` as BgmCue : null;
    else if (this.scene === 'departure') cue = `boss-${STAGES[this.stage - 1].boss}` as BgmCue;
    else if (this.scene === 'gift') cue = 'boss-jinrai';
    else if (this.scene === 'arrival') cue = this.midboss ? STAGES[this.stage - 1].bgm : `boss-${STAGES[this.stage - 1].boss}` as BgmCue;
    else if (this.scene === 'clear') cue = null;
    else if (this.scene === 'ending' || this.scene === 'credits') cue = 'ending';
    else if (['title', 'difficulty', 'player', 'practice', 'option', 'help', 'notebook'].includes(this.scene)) cue = 'title';
    else if (this.scene === 'dialogue' && (this.afterDialogue === 'boss' || this.afterDialogue === 'clear' || this.afterDialogue === 'gift')) cue = `boss-${STAGES[this.stage - 1].boss}` as BgmCue;
    else if (this.phase && !this.midboss) cue = `boss-${STAGES[this.stage - 1].boss}` as BgmCue;
    else cue = STAGES[this.stage - 1].bgm;
    this.bgm.sync(cue, false, lastbossQuiet || postBossQuiet ? 0.35 : 1);
  }

  private updateMenu(): void {
    if (this.scene === 'ending') {
      this.endingFrame++;
      if (this.accept() && !this.endingComplete) {
        // 全文表示は未読の行を消す操作ではない。残りも1行3秒の余裕を取る。
        const unread = this.endingLines.filter((_, index) => this.endingLineAlpha(index) < 1).length;
        this.endingReadDuration = Math.max(ENDING_READ_FRAMES, unread * ENDING_LINE_GAP);
        this.endingRevealed = true;
      }
      if (this.endingComplete) this.endingReadFrame++;
      if (this.endingReadFrame >= this.endingReadDuration) { this.scene = 'credits'; this.creditsFrame = 0; }
      return;
    }
    if (this.scene === 'credits') {
      this.creditsFrame += this.creditsFrame < CREDITS_ROLL_FRAMES && this.held('KeyZ') ? 2 : 1;
      if (this.just('KeyX')) this.creditsFrame = Math.max(this.creditsFrame, CREDITS_ROLL_FRAMES);
      if (this.creditsFrame >= CREDITS_ROLL_FRAMES + CREDITS_HOLD_FRAMES) this.returnToTitle();
      return;
    }
    if (this.scene === 'clear' && this.accept()) {
      if (this.practice) this.returnToTitle();
      else if (this.stage < STAGES.length) this.startStage(this.stage + 1);
      else this.startMovies(ENDING_MOVIES, () => this.startEnding());
      return;
    }
    const counts: Partial<Record<Scene, number>> = { title: 5, difficulty: 4, player: PLAYERS.length, practice: this.unlocked, option: 2, notebook: STAGES.length, pause: 3, gameover: 2 };
    const count = counts[this.scene] ?? 1;
    if (this.just('ArrowDown')) this.menu = (this.menu + 1) % count;
    if (this.just('ArrowUp')) this.menu = (this.menu + count - 1) % count;
    if (this.scene === 'option') {
      const change = (Number(this.just('ArrowRight')) - Number(this.just('ArrowLeft'))) * 10;
      if (change && this.menu === 0) {
        this.optionVolume = Math.max(0, Math.min(100, this.optionVolume + change));
        this.audio.volume = this.optionVolume / 100;
        safeSave('owlery-volume', String(this.optionVolume));
      }
      if (change && this.menu === 1) {
        this.optionBgmVolume = Math.max(0, Math.min(100, this.optionBgmVolume + change));
        this.bgm.setVolume(this.optionBgmVolume);
        safeSave('owlery-bgm-volume', String(this.optionBgmVolume));
      }
    }
    if (this.just('KeyX') || this.just('Escape')) {
      if (this.scene === 'pause') this.scene = this.resumeScene;
      else if (this.scene === 'difficulty' || this.scene === 'option' || this.scene === 'help' || this.scene === 'practice' || this.scene === 'notebook') this.returnToTitle();
      else if (this.scene === 'player') this.scene = 'difficulty';
      return;
    }
    if (!this.accept()) return;
    this.audio.play('item');
    switch (this.scene) {
      case 'title': this.scene = (['difficulty', 'practice', 'option', 'help', 'notebook'] as Scene[])[this.menu]; this.menu = 0; break;
      case 'difficulty':
        this.difficulty = DIFFICULTIES[this.menu]; this.menu = 0;
        if (PLAYERS.length === 1) { this.player = PLAYERS[0]; this.practice = false; this.startRun(); this.startMovies(['opening'], () => this.startStage(1)); }
        else this.scene = 'player';
        break;
      case 'player': this.player = PLAYERS[this.menu]; this.practice = false; this.startRun(); this.startMovies(['opening'], () => this.startStage(1)); break;
      case 'practice': this.practice = true; this.startRun(); this.startStage(this.menu + 1); break;
      case 'option': case 'help': case 'notebook': this.returnToTitle(); break;
      case 'pause': {
        const selected = this.menu;
        this.menu = 0;
        if (selected === 0) this.scene = this.resumeScene;
        if (selected === 1) this.returnToTitle();
        if (selected === 2) this.startStage(this.stage);
        break;
      }
      case 'gameover': if (this.menu === 0) { this.startRun(); this.startStage(this.stage); } else this.returnToTitle(); this.menu = 0; break;
    }
  }

  private startRun(): void {
    this.resetBossPresentation();
    this.score = 0; this.power = 0; this.lives = 2; this.bombs = 3; this.graze = 0; this.point = 10000;
    this.awakened = false;
  }

  private resetBossPresentation(): void {
    this.postBoss = false; this.departureFrame = 0; this.boss = undefined; this.phase = undefined;
    this.transition = undefined; this.transitionFrame = 0;
    this.arrivalFrame = 0; this.arrivalFromWhite = false; this.giftFrame = 0;
    this.bgm.sync(this.bgm.cue, false, 1);
  }

  private returnToTitle(): void {
    this.resetBossPresentation();
    this.scene = 'title'; this.menu = 0;
  }

  private startMovies(names: readonly MovieName[], done: () => void): void {
    this.movieDone = done;
    const next = (index: number) => {
      if (index >= names.length) {
        if (this.movieName === 'lastboss') this.startLastbossOut();
        else if (this.movieName === 'jinrai-gift' || this.movieName === 'minerva-finale') this.startAfterBossOut();
        else this.finishMovies();
        return;
      }
      this.scene = 'movie';
      this.movieName = names[index];
      this.syncBgm();
      this.movies.play(names[index], () => next(index + 1), names[index] === 'lastboss' || names[index] === 'jinrai-gift' || names[index] === 'minerva-finale');
    };
    next(0);
  }

  private finishMovies(): void {
    this.movies.stop();
    this.movieName = undefined;
    const done = this.movieDone;
    this.movieDone = undefined;
    done?.();
    this.syncBgm();
  }

  private clearEncounter(): void {
    this.clearBullets(); this.enemies.clear(); this.shots.clear(); this.clones.clear();
    this.pendingHit = -1; this.bombFrames = 0; this.flash = 0;
  }

  private startLastbossMovie(): void {
    this.clearEncounter();
    this.transition = 'lastboss-in'; this.transitionFrame = 0; this.scene = 'transition';
  }

  private startLastbossOut(): void {
    this.transitionFadeStart = this.movies.current ? this.movieWhiteAlpha : 1;
    this.movies.freeze();
    this.transition = 'lastboss-out'; this.transitionFrame = 0; this.scene = 'transition';
    this.syncBgm();
  }

  private updateTransition(): void {
    this.transitionFrame++;
    if (this.transition === 'lastboss-in') {
      this.sceneryDistance += 1.8;
      if (this.invulnFrames > 0) this.invulnFrames--;
      this.updatePlayer(false);
      if (this.transitionFrame >= 90) {
        this.transition = undefined;
        this.startMovies(['lastboss'], () => this.startConversation('minerva', 'before', 'boss', true));
      }
    } else if (this.transition === 'lastboss-out') {
      if (this.transitionFrame >= 150) {
        this.movies.stop(); this.movieName = undefined;
        this.transition = 'lastboss-hold'; this.transitionFrame = 0;
        this.bgm.preload('boss-minerva');
      }
    } else if (this.transition === 'lastboss-hold') {
      if (this.transitionFrame >= 60) {
        this.transition = undefined;
        this.finishMovies();
      }
    } else if (this.transition === 'boss-defeat-flash' || this.transition === 'boss-defeat-in') {
      this.sceneryDistance += 1.8;
      if (this.invulnFrames > 0) this.invulnFrames--;
      this.updatePlayer(false);
      this.updateParticles();
      if (this.transitionFrame >= (this.transition === 'boss-defeat-flash' ? 8 : 90)) {
        if (this.transition === 'boss-defeat-flash') this.transition = 'boss-defeat-in';
        else if (this.stage >= 4) {
          this.transition = undefined;
          this.startMovies([this.stage === 4 ? 'jinrai-gift' : 'minerva-finale'], () => this.startAfterBossConversation());
        } else this.transition = 'boss-defeat-hold';
        this.transitionFrame = 0;
      }
    } else if (this.transition === 'boss-defeat-hold') {
      if (this.transitionFrame >= 60) {
        this.transition = undefined;
        if (this.movieDone) this.finishMovies();
        else this.startAfterBossConversation();
      }
    } else if (this.transitionFrame >= 150) {
      this.movies.stop(); this.movieName = undefined;
      this.transition = 'boss-defeat-hold'; this.transitionFrame = 0;
    }
  }

  private startAfterBossOut(): void {
    this.transitionFadeStart = this.movies.current ? this.movieWhiteAlpha : 1;
    this.movies.freeze();
    this.transition = `${this.movieName as AfterBossMovie}-out`;
    this.transitionFrame = 0; this.scene = 'transition';
    this.syncBgm();
  }

  get movieWhiteAlpha(): number {
    if (this.movieName !== 'lastboss' && this.movieName !== 'jinrai-gift' && this.movieName !== 'minerva-finale') return 0;
    return Math.max(0, Math.min(1, 1 - (this.movies.current?.currentTime ?? 0) / 1.5));
  }

  get whiteAlpha(): number {
    if (this.scene === 'movie') return this.movieWhiteAlpha;
    if (this.scene === 'transition' && this.transition?.startsWith('lastboss')) return this.transition === 'lastboss-hold' ? 1 : this.transition === 'lastboss-in' ? Math.min(1, this.transitionFrame / 90) : this.transitionFadeStart + (1 - this.transitionFadeStart) * Math.min(1, this.transitionFrame / 150);
    if (this.scene === 'transition' && this.postBoss) {
      if (this.transition === 'boss-defeat-flash') return 0;
      if (this.transition === 'boss-defeat-in') return Math.min(1, this.transitionFrame / 90);
      if (this.transition === 'boss-defeat-hold') return 1;
      return this.transitionFadeStart + (1 - this.transitionFadeStart) * Math.min(1, this.transitionFrame / 150);
    }
    if ((this.scene === 'arrival' || (this.scene === 'pause' && this.resumeScene === 'arrival')) && this.arrivalFromWhite) return Math.max(0, 1 - this.arrivalFrame / 120);
    return 0;
  }

  private startAfterBossConversation(): void {
    this.startConversation(STAGES[this.stage - 1].boss, 'after', this.stage === 4 ? 'gift' : 'clear');
    this.arrivalFrame = 0; this.arrivalFromWhite = true; this.scene = 'arrival';
  }

  private startArrival(boss: BossId, mid: boolean, fromWhite = false): void {
    this.clearEncounter();
    this.boss = boss; this.midboss = mid;
    this.arrivalFrame = 0; this.arrivalFromWhite = fromWhite;
    this.scene = 'arrival';
  }

  private updateArrival(): void {
    if (this.just('Escape')) { this.resumeScene = 'arrival'; this.scene = 'pause'; this.menu = 0; return; }
    this.sceneryDistance += 1.8;
    if (this.invulnFrames > 0) this.invulnFrames--;
    this.updatePlayer(false);
    if (++this.arrivalFrame >= (this.arrivalFromWhite ? 120 : 80)) this.scene = 'dialogue';
  }

  private startEnding(): void { this.scene = 'ending'; this.endingFrame = 0; this.endingReadFrame = 0; this.endingReadDuration = ENDING_READ_FRAMES; this.endingRevealed = false; }
  get endingComplete(): boolean { return this.endingRevealed || this.endingFrame >= (this.endingLines.length - 1) * ENDING_LINE_GAP + ENDING_LINE_FADE; }
  get endingExitAlpha(): number { return Math.max(0, Math.min(1, (this.endingReadFrame - this.endingReadDuration + ENDING_EXIT_FRAMES) / ENDING_EXIT_FRAMES)); }
  endingLineAlpha(index: number): number { return this.endingRevealed ? 1 : Math.max(0, Math.min(1, (this.endingFrame - index * ENDING_LINE_GAP) / ENDING_LINE_FADE)); }

  startStage(stage: number): void {
    this.movies.stop();
    this.movieName = undefined;
    this.movieDone = undefined;
    this.transition = undefined;
    this.postBoss = false; this.departureFrame = 0; this.giftFrame = 0;
    this.arrivalFrame = 0; this.arrivalFromWhite = false;
    this.stage = stage;
    this.stageFrame = 0;
    this.stageIntroFrame = this.presentation ? 0 : 180;
    if (stage === 5) this.movies.preload(['lastboss', 'minerva-finale', ...ENDING_MOVIES]);
    if (stage === 4) this.movies.preload(['jinrai-gift']);
    this.sceneryDistance = 0;
    this.midbossElapsedFrames = 0;
    this.collectionFrames = 0;
    this.scene = 'stage';
    this.boss = undefined;
    this.midboss = false;
    this.phase = undefined;
    this.phaseIndex = -1;
    this.initialPhaseHpRatio = undefined;
    this.minervaReprise = undefined;
    this.px = FIELD.w / 2;
    this.py = FIELD.h - 50;
    this.pendingHit = -1;
    this.invulnFrames = 120;
    this.clearBullets(); this.shots.clear(); this.enemies.clear(); this.items.clear(); this.particles.clear(); this.clones.clear();
    this.highScore = safeLoad(`owlery-high-${this.difficulty}`, 0, (s) => Number(s) || 0);
    this.messageFrames = 0;
  }

  private updateStage(): void {
    if (this.just('Escape')) { this.resumeScene = 'stage'; this.scene = 'pause'; this.menu = 0; return; }
    // 中ボスで道中の時計が止まっても、世界のスクロールは続ける。
    this.sceneryDistance += this.phase ? 0.65 : 1.8;
    if (this.stageIntroFrame < 180) {
      const curtain = this.stageIntroFrame < 45;
      this.stageIntroFrame++;
      if (curtain) { this.updatePlayer(false); return; }
    }
    const collecting = this.collectionFrames > 0;
    if (!this.phase && !collecting) this.stageFrame++;
    if (this.invulnFrames > 0) this.invulnFrames--;
    if (this.bombFrames > 0) this.bombFrames--;
    this.updatePlayer();
    if (this.bombFrames > 0) {
      this.clearBullets();
      if (this.frame % 10 === 0) {
        this.enemies.forEach((enemy) => { enemy.hp -= 2; enemy.hitFrames = 8; });
        if (this.phase) this.damageBoss(2.5);
      }
    }
    if (!collecting) {
      if (this.phase) this.updateBoss();
      else this.updateWaves();
    }
    if (this.scene !== 'stage') return;
    updateInterviewRings(this);
    updateObsidiaGraph(this.attackContext());
    this.updateShots();
    this.updateClones();
    this.updateBullets();
    this.updateEnemies();
    this.updateItems();
    this.updateParticles();
    if (this.pendingHit >= 0) {
      this.pendingHit++;
      if (this.pendingHit >= 8) this.commitHit();
    }
    if (collecting && this.scene === 'stage' && --this.collectionFrames === 0) this.leaveBossFight();
  }

  private updatePlayer(canAttack = true): void {
    let dx = Number(this.held('ArrowRight')) - Number(this.held('ArrowLeft'));
    let dy = Number(this.held('ArrowDown')) - Number(this.held('ArrowUp'));
    const focus = this.held('ShiftLeft') || this.held('ShiftRight');
    const length = Math.hypot(dx, dy) || 1;
    const bogTime = this.phase?.pattern === 'neoEncore' && this.encoreCount === 3 ? encoreBogTime(this) : this.phaseFrame - 105;
    const bogged = (this.phase?.pattern === 'dotfiles' || (this.phase?.pattern === 'neoEncore' && this.encoreCount === 3)) && inBog(this.px, this.py, bogTime);
    const speed = (focus ? 1.65 : 3.65) * (bogged ? 0.55 : 1);
    dx = dx / length * speed; dy = dy / length * speed;
    if (this.phase?.pattern === 'gravityShift') {
      const gravity = gravityScene(this.phaseFrame + 1, this.difficulty);
      dx += gravity.dx * gravity.force; dy += gravity.dy * gravity.force;
    }
    this.playerDx = dx;
    this.px = Math.max(9, Math.min(FIELD.w - 9, this.px + dx));
    this.py = Math.max(12, Math.min(FIELD.h - 9, this.py + dy));
    if (!canAttack) return;
    if ((this.held('KeyZ') || this.autoshot) && this.frame % 5 === 0) this.fireShot(focus);
    if (this.just('KeyX') && this.bombs > 0 && this.bombFrames <= 0) this.useBomb();
  }

  private fireShot(focus: boolean): void {
    const tier = Math.floor(this.power);
    const base = 1.35;
    const count = this.awakened ? 5 : 2 + Math.floor(tier / 2);
    for (let i = 0; i < count; i++) {
      const shot = this.shots.acquire(); if (!shot) break;
      shot.x = this.px + (i - (count - 1) / 2) * (focus ? 6 : 10);
      shot.y = this.py - 14;
      shot.vx = 0;
      shot.vy = -10.5;
      shot.damage = base;
      shot.radius = 3;
      shot.homing = true;
    }
    // 最大Powerの補助弾は半分の頻度。通常は斜め前方を補い、低速では全弾を正面へ束ねる。
    if (tier >= MAX_POWER && this.frame % 10 === 0) {
      const angles = this.awakened ? [20, 40] : [15, 30];
      const clusterSize = this.awakened ? 2 : 1;
      for (const side of [-1, 1]) for (const [index, degrees] of angles.entries()) {
        const angle = focus ? 0 : degrees * Math.PI / 180;
        const originX = this.px + side * (focus ? this.awakened ? 21 + index * 16 : 15 + index * 6 : 12);
        for (let lane = 0; lane < clusterSize; lane++) {
          const shot = this.shots.acquire(); if (!shot) break;
          // 進行方向に垂直な6px間隔で並べ、飛翔中も2発の束が広がらないようにする。
          const offset = (lane - (clusterSize - 1) / 2) * 6;
          Object.assign(shot, {
            x: originX + Math.cos(angle) * offset, y: this.py - 10 + side * Math.sin(angle) * offset,
            vx: side * Math.sin(angle) * 10.5, vy: -Math.cos(angle) * 10.5,
            damage: 0.65, radius: 2, homing: false,
          });
        }
      }
    }
    this.audio.play('shot');
  }

  private useBomb(): void {
    this.bombs--;
    if (deathbomb(this.pendingHit, this.bombs + 1)) this.pendingHit = -1;
    this.bombFrames = 150;
    this.invulnFrames = Math.max(this.invulnFrames, this.bombFrames);
    this.bombUsed = true;
    this.flash = 14;
    this.audio.play('bomb');
    this.clearBullets();
    this.enemies.forEach((enemy) => { enemy.hp -= 24; enemy.hitFrames = 8; });
    if (this.phase) this.damageBoss(36);
    this.message = '書いて残す七重の頁';
    this.messageFrames = 110;
  }

  private commitHit(): void {
    this.pendingHit = -1;
    if (this.invincible) return;
    this.vimAttack = undefined;
    this.lives--;
    this.bombs = Math.max(3, this.bombs);
    const lostPower = Math.min(1, this.power);
    this.power = Math.max(0, this.power - 1);
    this.awakened = false;
    this.invulnFrames = 180;
    this.hitDuringSpell = true;
    this.audio.play('hit');
    this.flash = 10;
    // 大Pで一度に取り戻せないよう、小Pを画面全体へ分散する。拾いに行く範囲をプレイヤーが選ぶ。
    const recoveryCount = Math.floor((lostPower + 1e-9) / 0.05);
    for (let i = 0; i < recoveryCount; i++) this.scatterItem('small', i, recoveryCount);
    for (let i = 0; i < 3; i++) this.spawnItem(this.px + (Math.random() - 0.5) * 60, this.py - 15, 'point', false);
    if (this.lives < 0) { this.scene = 'gameover'; this.menu = 0; }
  }

  private get bossAt(): number { return this.stage === 5 ? Math.max(2900, 8370 - this.midbossElapsedFrames) : 4900; }

  private updateWaves(): void {
    const t = this.stageFrame;
    // 追加2技の標準所要時間を足し、普段の道中後半を保つ。長引いた場合も登場を逃さない。
    const bossAt = this.bossAt;
    if (t === 2450) { this.startMidboss(); return; }
    if (t === bossAt) {
      if (this.stage === 5) this.startLastbossMovie();
      else this.startConversation(STAGES[this.stage - 1].boss, 'before', 'boss');
      return;
    }
    const interval = [135, 120, 108, 96, 88][this.stage - 1];
    if ((t < 2310 || (t > 2710 && t < bossAt - 120)) && t % interval === 20) {
      const wave = Math.floor(t / interval);
      const kinds: WaveKind[] = ['arc', 'chevron', 'cross', 'serpent', 'ring', 'pincer', 'threeWay', 'orbit', 'return', 'sweep'];
      // 面と前後半で順序を変える。練習では同じ編隊を再現できる。
      const order = wave + (this.stage - 1) * 3 + (t > 2710 ? 4 : 0);
      const kind = kinds[order % kinds.length];
      this.spawnWave(kind, wave);
      // 新編隊は全員に役割があるため、追加の交差隊を重ねず動きを見せる。
      const coordinated = kind === 'pincer' || kind === 'serpent' || kind === 'orbit' || kind === 'chevron';
      if (!coordinated && this.stage >= 3 && wave % (this.stage >= 4 ? 2 : 3) === 1) {
        this.spawnWave(wave % 3 === 1 ? 'cross' : 'return', wave + 1, true);
      }
    }
  }

  private spawnWave(kind: WaveKind, wave: number, secondary = false): void {
    const side = wave % 2 ? -1 : 1;
    const count = secondary ? 4 : kind === 'orbit' ? 6 : this.stage <= 2 ? 7 : 6;
    for (let i = 0; i < count; i++) {
      // 旋回隊の滞在中にも次の主編隊が入れる余地を残す。
      if (this.enemies.count >= 18) break;
      const enemy = this.enemies.acquire(); if (!enemy) break;
      const enemyKind = kind === 'ring' && i > 0 ? 'return' : kind;
      const enemySide = kind === 'pincer' ? (i % 2 ? -1 : 1) : side;
      const originX = kind === 'pincer' ? (enemySide > 0 ? -22 : FIELD.w + 22)
        : kind === 'chevron' ? 192 + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * 32
        : kind === 'serpent' ? 192 + side * 64
        : kind === 'orbit' ? 192
        : kind === 'cross' ? (side > 0 ? -22 : FIELD.w + 22)
        : kind === 'ring' ? 192
        : kind === 'arc' ? (side > 0 ? -10 : FIELD.w + 10)
        : 76 + ((wave * 61 + i * 67 + (secondary ? 105 : 0)) % 234);
      const originY = kind === 'pincer' ? 55 + Math.floor(i / 2) * 38
        : kind === 'cross' ? 75 + i * 29
        : kind === 'chevron' ? -20 - Math.ceil(i / 2) * 24 : -20 - i * 16;
      Object.assign(enemy, { x: originX, y: originY, originX, originY, side: enemySide, kind: enemyKind, slot: secondary ? i + 6 : i,
        vx: 0, vy: 0, hp: enemyKind === 'ring' ? 12 + this.stage * 2 : 2 + this.stage,
        age: 0, hitFrames: 0, color: (wave + i) % 3 });
    }
  }

  private startConversation(boss: BossId, moment: 'before' | 'after', next: 'boss' | 'mid' | 'stage' | 'clear' | 'gift', fromWhite = false): void {
    this.clearBullets(); this.enemies.clear(); this.shots.clear(); this.clones.clear();
    this.boss = boss;
    if (next === 'boss') this.midboss = false;
    this.lines = dialogue(this.player, boss, moment);
    this.lineIndex = 0;
    this.afterDialogue = next;
    if (moment === 'before' && (next === 'boss' || next === 'mid')) this.startArrival(boss, next === 'mid', fromWhite);
    else this.scene = 'dialogue';
  }

  private updateDialogue(): void {
    if (this.held('ControlLeft') || this.held('ControlRight')) {
      if (this.frame % 5 === 0) this.nextLine();
    } else if (this.accept()) this.nextLine();
    if (this.just('Escape')) { this.resumeScene = 'dialogue'; this.scene = 'pause'; this.menu = 0; }
  }

  private nextLine(): void {
    this.lineIndex++;
    if (this.lineIndex < this.lines.length) return;
    if (this.afterDialogue === 'boss') this.startBoss(false, 0);
    if (this.afterDialogue === 'mid') this.startBoss(true, 0);
    if (this.afterDialogue === 'stage') { this.scene = 'stage'; this.boss = undefined; }
    if (this.afterDialogue === 'clear') this.startDeparture();
    if (this.afterDialogue === 'gift') this.startGift();
  }

  private startGift(): void {
    this.clearEncounter();
    this.clearBonus = this.calculateClearBonus();
    this.giftFrame = 0;
    this.scene = 'gift';
    this.tossItems(['life', 'bomb', 'life', 'radiant', 'bomb', 'life', 'bomb'], true);
  }

  private tossItems(kinds: ItemKind[], gift = false): void {
    const [x, y] = this.bossPosition();
    const center = (kinds.length - 1) / 2;
    kinds.forEach((kind, index) => {
      const offset = (index - center) * 3 / Math.max(1, center);
      const item = this.spawnItem(x, y, kind, true);
      // 動きは退場報酬と餞別で共有し、羽根の最高形態化だけをgiftで区別する。
      if (item) Object.assign(item, { gift, tossed: true, launchFrames: 50, vx: offset * 0.8, vy: -1.8 - (3 - Math.abs(offset)) * 0.2 });
    });
  }

  private updateGift(): void {
    if (this.just('Escape')) { this.resumeScene = 'gift'; this.scene = 'pause'; this.menu = 0; return; }
    this.sceneryDistance += 1.8;
    this.updatePlayer(false);
    this.updateItems();
    this.updateParticles();
    this.giftFrame++;
    if (!this.items.objects.some((item) => item.active && item.gift)) this.startDeparture();
  }

  private startDeparture(): void {
    if (this.stage !== 4) this.clearBonus = this.calculateClearBonus();
    this.departureFrame = 0; this.scene = 'departure';
    this.clearReadyFrame = -1;
    if (this.stage <= 3) {
      const powerItem = this.power >= MAX_POWER && !this.awakened && Math.random() < 0.05 ? 'radiant' : 'large';
      this.tossItems(['life', 'bomb', powerItem]);
    }
    this.spark(192, 77, '#fff0bc', 45);
  }

  private updateDeparture(): void {
    if (this.just('Escape')) { this.resumeScene = 'departure'; this.scene = 'pause'; this.menu = 0; return; }
    this.sceneryDistance += 1.8;
    this.updatePlayer(false); this.updateItems(); this.updateParticles();
    this.departureFrame++;
    if (this.departureFrame <= 60 && this.departureFrame % 3 === 0) {
      const [x, y] = this.bossPosition();
      this.spark(x, y, '#fff0bc', 4);
    }
    // 光と回収が終わってから背景だけが流れる余韻を取り、入力は退場中のままにする。
    if (this.departureFrame >= 60 && this.items.count === 0 && this.particles.count === 0) {
      if (this.clearReadyFrame < 0) this.clearReadyFrame = this.departureFrame;
      if (this.departureFrame - this.clearReadyFrame < 90) return;
      this.boss = undefined;
      this.finishStage(this.clearBonus);
    }
  }

  private startMidboss(): void {
    const mid = STAGES[this.stage - 1].mid;
    this.clearBullets(); this.enemies.clear(); this.shots.clear(); this.clones.clear();
    this.boss = mid;
    this.midboss = true;
    this.lines = midDialogue(this.player, mid, this.stage);
    this.lineIndex = 0;
    this.afterDialogue = 'mid';
    this.startArrival(mid, true);
  }

  startBoss(mid: boolean, index: number): void {
    this.stageIntroFrame = 180;
    this.scene = 'stage';
    this.collectionFrames = 0;
    this.midboss = mid;
    this.boss = mid ? STAGES[this.stage - 1].mid : STAGES[this.stage - 1].boss;
    const phases = mid ? midPhases(this.boss, this.stage) : STAGES[this.stage - 1].phases;
    this.phaseIndex = Math.max(0, Math.min(index, phases.length - 1));
    this.beginPhase(phases[this.phaseIndex]);
  }

  private beginPhase(phase: Phase): void {
    this.audio.stopEnergy();
    this.bossEntry = this.phase ? this.bossPosition() : [192, phase.spell ? 132 : 77];
    this.phase = phase;
    this.keyboardWord = '';
    this.phaseFrame = 0;
    this.minervaFlightPairStart = -1;
    this.minervaFlightThirdStart = -1;
    this.minervaInterviewLateStart = -1;
    this.minervaInterviewNextShot = 105;
    this.minervaInterviewWave = 0;
    this.lastBossShotFrame = -1;
    this.bossCastFrame = -Infinity;
    this.encoreCount = 0;
    this.phaseHp = phase.hp * (this.initialPhaseHpRatio ?? 1);
    this.phaseMaxHp = phase.hp;
    this.initialPhaseHpRatio = undefined;
    this.jinraiLasers.length = 0;
    this.jinraiBolts.length = 0; this.jinraiThunderstorm = undefined;
    this.minervaReprise = undefined;
    this.jinraiDashTick = -1;
    this.jinraiDashDouble = false;
    this.jinraiDashCrossing = -1;
    this.jinraiDashY = 115;
    this.jinraiDashDirection = 1;
    this.jinraiDashTrails.length = 0;
    this.jinraiBurstStartFrame = -1;
    this.jinraiBurstCount = 0;
    this.jinraiBurstFromX = 192;
    this.jinraiBurstFromY = 132;
    this.jinraiBurstFlashUntil = 0;
    this.jinraiWindDirection = 0;
    this.bombUsed = false;
    this.hitDuringSpell = false;
    this.clearBullets(); this.shots.clear(); this.clones.clear();
    if (phase.spell) {
      this.spellBonus = 1_000_000 + this.stage * 500_000;
      this.cutin = phase.pattern === 'jinraiDash' ? 0 : 100;
      this.flash = phase.pattern === 'jinraiDash' ? 0 : 12;
      if (phase.pattern !== 'jinraiDash') this.audio.play('declare');
    }
  }

  skipPhase(): void { if (this.phase && this.scene === 'stage') this.finishPhase(true); }

  private finishPhase(defeated: boolean): void {
    const phase = this.phase;
    if (!phase) return;
    const position = this.bossPosition();
    this.minervaReprise = undefined;
    if (phase.spell && defeated && !this.bombUsed && !this.hitDuringSpell && this.pendingHit < 0) {
      this.addScore(this.spellBonus);
      this.message = '技の記録ボーナス！';
      this.messageFrames = 170;
      this.audio.play('capture');
    }
    const next = (this.midboss ? midPhases(this.boss!, this.stage) : STAGES[this.stage - 1].phases)[this.phaseIndex + 1];
    if (!this.midboss && !next) {
      this.bossDefeatOrigin = position;
      this.phase = undefined; this.phaseIndex++;
      this.clearEncounter(); this.jinraiLasers.length = 0; this.items.clear();
      this.postBoss = true; this.collectionFrames = 0; this.cutin = 0;
      this.flash = 8; this.messageFrames = 0;
      this.transition = 'boss-defeat-flash'; this.transitionFrame = 0; this.scene = 'transition';
      this.spark(position[0], position[1], '#fff0bc', 45);
      this.syncBgm();
      return;
    }
    this.supplyPhaseItems();
    this.bullets.forEach((b) => {
      // 画面外で戻り待ちの弾も、得点アイテムを回収できる位置へ寄せる。
      const returns = b.motion === 'jinraiHeart' || b.motion === 'recall';
      const x = returns ? Math.max(12, Math.min(FIELD.w - 12, b.x)) : b.x;
      const y = returns ? Math.max(20, Math.min(FIELD.h - 20, b.y)) : b.y;
      this.spawnItem(x, y, 'point', true);
    });
    for (const node of this.graphNodes) this.spawnItem(node.x, node.y, 'point', true);
    this.clearBullets(); this.clones.clear();
    this.flash = 8;
    if (next) { this.phaseIndex++; this.beginPhase(next); }
    else {
      // 会話へ進む前に手で拾う時間を残す。近づいて拾うまで補充を直接加算しない。
      this.phase = undefined;
      this.collectionFrames = 180;
      this.jinraiLasers.length = 0;
      this.jinraiBolts.length = 0; this.jinraiThunderstorm = undefined;
      this.enemies.clear(); this.shots.clear();
      this.message = '補充品を回収しよう';
      this.messageFrames = 180;
    }
  }

  private leaveBossFight(): void {
    if (this.boss === 'chappy') this.startConversation('chappy', 'after', 'stage');
    else if (this.boss === 'etokichi' && this.stage === 5) {
      this.lines = [
        { who: 'etokichi', text: 'ここまで来たら、もう大丈夫だねー。ぼくの返事も「行く」だよ、キチ！' },
        { who: 'mimiko', text: 'ふわっ。門からここまで、星がつないでくれたのね。約束の続きを届けるの。' },
      ];
      this.lineIndex = 0;
      this.afterDialogue = 'stage';
      this.scene = 'dialogue';
    } else { this.boss = undefined; this.scene = 'stage'; }
  }

  private supplyPhaseItems(): void {
    const multiplier = this.stage >= 4 && !this.midboss ? 2 : 1;
    const kinds: ItemKind[] = Array<ItemKind>(10 * multiplier).fill('small');
    // 後半の本ボスはP量と追加品の確率を倍増する。ライフとボムは同時には出さない。
    const roll = Math.random();
    // 光の羽根は「追加なし」の枠から抽選し、ライフとボムの確率を保つ。
    const bonus: ItemKind | undefined = roll < 0.02 * multiplier ? 'life' : roll < 0.32 * multiplier ? 'bomb'
      : this.power >= MAX_POWER && !this.awakened && roll < 0.34 * multiplier ? 'radiant' : undefined;
    // 追加品がいつも同じ区画へ出ないよう、散布順のランダムな位置へ挿入する。
    if (bonus) kinds.splice(Math.floor(Math.random() * (kinds.length + 1)), 0, bonus);
    kinds.forEach((kind, index) => { this.scatterItem(kind, index, kinds.length); });
  }

  private scatterItem(kind: ItemKind, index: number, count: number): void {
    // 横5列・縦4段へ分けてから乱数でずらし、乱数が偏っても被弾Pが一か所に固まらないようにする。
    const columns = Math.min(count, 5);
    const rows = Math.ceil(count / columns);
    const x = 24 + ((index % columns + 0.2 + Math.random() * 0.6) / columns) * (FIELD.w - 48);
    const y = 64 + ((Math.floor(index / columns) + 0.2 + Math.random() * 0.6) / rows) * 240;
    const item = this.spawnItem(x, y, kind, false);
    if (item) {
      item.manual = true;
      item.vx = (Math.random() - 0.5) * 0.6;
      item.vy = -0.6;
    }
  }

  private updateBoss(): void {
    const phase = this.phase!;
    this.phaseFrame++;
    if (phase.pattern === 'jinraiDash') {
      if (this.phaseFrame === DASH_CHARGE_START) this.audio.play('jinraiCharge');
      if (this.phaseFrame === DASH_CUTIN) { this.cutin = 100; this.flash = 12; this.audio.play('declare'); }
      if (this.phaseFrame === DASH_CHARGED) { this.audio.play('jinraiCrackle'); this.spark(...this.bossXY, '#ffe45c', 32); }
    }
    if (this.midboss) this.midbossElapsedFrames++;
    if (phase.spell) this.spellBonus = Math.max(0, this.spellBonus - 22);
    if (this.phaseFrame >= 105) this.emitPattern(phase.pattern);
    updateJinraiHazards(this.attackContext());
    updateGalaxyFlash(this);
    if (phase.pattern !== 'final' && this.phaseHp <= 0) { this.finishPhase(true); return; }
    if (Number.isFinite(phase.duration) && this.phaseFrame >= phase.duration * 60) {
      if (phase.pattern === 'neoEncore' && this.encoreCount < 3) {
        this.encoreCount++;
        this.phaseFrame = 104;
        this.bossCastFrame = -Infinity;
        this.clearBullets();
        this.message = '最後にもう一つだけ！';
        this.messageFrames = 100;
      } else this.finishPhase(phase.pattern === 'final');
    }
  }

  bossPosition(): [number, number] {
    if (this.postBoss) {
      if (this.scene === 'transition' && (this.transition === 'boss-defeat-flash' || this.transition === 'boss-defeat-in')) {
        const elapsed = this.transitionFrame + (this.transition === 'boss-defeat-in' ? 8 : 0);
        const progress = Math.min(1, elapsed / 98);
        const ease = progress * progress * (3 - 2 * progress);
        return [this.bossDefeatOrigin[0] + (192 - this.bossDefeatOrigin[0]) * ease, this.bossDefeatOrigin[1] + (77 - this.bossDefeatOrigin[1]) * ease];
      }
      const departing = this.scene === 'departure' || (this.scene === 'pause' && this.resumeScene === 'departure');
      return [192, departing ? 77 - 125 * Math.min(1, this.departureFrame / 60) ** 3 : 77];
    }
    if (this.scene === 'arrival' || (this.scene === 'pause' && this.resumeScene === 'arrival')) {
      const progress = Math.min(1, this.arrivalFrame / 60);
      const target = this.midboss ? 132 : 77;
      return [192, -48 + (target + 48) * (1 - (1 - progress) ** 3)];
    }
    if (!this.phase && this.scene === 'dialogue' && (this.afterDialogue === 'boss' || this.afterDialogue === 'mid')) return [192, this.midboss ? 132 : 77];
    if (this.phase?.pattern === 'jinraiThunder' && this.phaseFrame >= 105) return thunderPosition(this.phaseFrame, this.difficulty);
    if (this.phase?.pattern === 'sweep') return sweepPosition(this.phaseFrame, ['easy', 'normal', 'hard', 'lunatic'].indexOf(this.difficulty));
    if (this.stage === 2 && this.phase) return obsidiaPosition(this.phase.pattern, this.phaseFrame, this.bossEntry);
    if (this.phase?.pattern === 'owlDawn') return dawnPosition(this.phaseFrame, this.minervaReprise);
    if (this.phase?.pattern === 'interview') return interviewPosition(this.phaseFrame, ['easy', 'normal', 'hard', 'lunatic'].indexOf(this.difficulty));
    if (this.phase?.pattern === 'jinraiClone') {
      const body = jinraiCloneScene(this.phaseFrame, this.phase.duration).bodies[0];
      return [body.x, body.y];
    }
    if (this.phase?.pattern === 'jinraiDash') {
      const step = dashBurstStep(this);
      return step >= 0 ? burstPosition(this, step) : dashPosition(this, this.bossEntry);
    }
    if (this.phase?.pattern === 'flash') return [192 + Math.sin(this.phaseFrame * 0.052) * 120, 132];
    if (this.phase) {
      const position = patternPosition(this.phase, this.phaseFrame, this.bossEntry, this.encoreCount);
      if (position) return position;
    }
    const baseY = this.phase?.spell ? 132 : 77;
    return [192 + Math.sin(this.phaseFrame * 0.012) * 42, baseY + Math.sin(this.phaseFrame * 0.018) * 4];
  }

  get bossXY(): [number, number] { return this.bossPosition(); }

  get remainingSpells(): number {
    if (!this.phase) return 0;
    return this.midboss ? midPhases(this.boss!, this.stage).slice(this.phaseIndex).filter((phase) => phase.spell).length : STAGES[this.stage - 1].phases.slice(this.phaseIndex + 1).filter((phase) => phase.spell).length;
  }

  bossTargets(): [number, number][] {
    const attack = this.attackContext();
    return attack.phase?.pattern === 'jinraiClone' && (attack === this || attack.phaseFrame >= 105)
      ? jinraiCloneScene(attack.phaseFrame, attack.phase.duration).bodies.filter((body) => body.opacity > 0).map((body) => [body.x, body.y]) : [this.bossPosition()];
  }

  private emitPattern(pattern: string): void {
    const t = this.phaseFrame - 105;
    if (this.phase?.kind === 'normal') emitBossNormal(this, pattern, t);
    else if (pattern.startsWith('jinrai')) emitJinraiPattern(this, pattern, t);
    else if (pattern === 'etoile') emitEtokichi(this, t);
    else if (pattern === 'galaxyFlash' || pattern === 'galaxyFlashDawn') emitGalaxyFlash(this, t);
    else if (pattern.startsWith('etokichi')) emitEtokichiDawn(this, pattern, t);
    else if (this.stage === 1 && !this.midboss) emitNeo(this, pattern, t);
    else if (this.stage === 2) emitObsidia(this, pattern, t);
    else if (pattern === 'neoEncore') emitNeoEncore(this, t);
    else if (this.boss === 'chappy') emitChappy(this, pattern, t);
    else if (this.boss === 'claudine') emitClaudine(this, pattern, t);
    else if (this.stage === 5) emitMinerva(this, pattern);
  }

  spawnBullet(x: number, y: number, vx: number, vy: number, color: number, kind: Bullet['kind'] = 'orb'): Bullet | undefined {
    const b = this.bullets.acquire(); if (!b) return undefined;
    Object.assign(b, { x, y, vx, vy, color, kind, radius: kind === 'star' ? 5 : kind === 'needle' ? 3 : 4, grazed: false, age: 0, split: false, delay: 0, fadeAt: 0, motion: 'normal', targetX: 0, targetY: 0, gridColumn: -1, gridRow: -1, dashWave: -1, dashOrder: -1, releaseAt: 0, sway: 0, swayRate: 0, swayPhase: 0, rotation: 0, spin: 0, launchSoundPending: !!(this.phase && this.boss) });
    b.keyLabel = undefined;
    return b;
  }

  // 一斉射は1回の構えにまとめ、連射でも移動ポーズへ戻る時間を確保する。
  triggerBossCast(): void {
    if (this.phase && this.boss && this.phaseFrame >= 105 && this.phaseFrame - this.bossCastFrame >= CAST_GAP) this.bossCastFrame = this.phaseFrame;
  }

  private clearBullets(): void {
    this.bullets.clear();
    this.jinraiBolts.length = 0; this.jinraiThunderstorm = undefined;
    this.vimAttack = undefined;
    this.interviewRings.length = 0;
    this.graphNodes.length = 0; this.graphEdges.length = 0; this.graphFrame = 0;
    this.galaxyFlash = undefined;
  }

  grazeAt(x: number, y: number): void {
    this.graze++; this.point += 10; this.addScore(100);
    this.audio.play('graze'); this.spark(x, y, '#fff6a3', 3);
  }

  attackContext(): Game { return repriseView(this); }

  clearAttackEffects(): void {
    this.clearBullets(); this.jinraiLasers.length = 0;
  }

  private updateBullets(): void {
    const attack = this.attackContext(), attackFrame = attack.phaseFrame;
    const attackLevel = ['easy', 'normal', 'hard', 'lunatic'].indexOf(attack.difficulty);
    const sakuraLevel = attack.phase?.pattern === 'jinraiSakura' ? attackLevel : -1;
    const sakuraTime = attackFrame - 105;
    const windFrame = sakuraTime >= SAKURA_PERIOD ? (sakuraTime - SAKURA_PERIOD) % SAKURA_PERIOD : -1;
    this.bullets.forEach((b) => {
      b.age++;
      if (b.motion === 'typographyRain') { b.vx = b.targetX + Math.sin(b.age * b.swayRate + b.swayPhase) * b.sway; b.rotation += b.spin; }
      if (b.motion === 'layoutGrid') {
        if (b.age < b.releaseAt) { b.x += (b.targetX - b.x) * 0.13; b.y += (b.targetY - b.y) * 0.13; }
        else {
          b.x = b.targetX; b.y = b.targetY;
          b.vx = b.sway; b.vy = b.swayRate; b.motion = 'normal';
          if (b.gridColumn === 0 && b.gridRow === 0) { this.triggerBossCast(); this.audio.play('laser'); }
        }
      }
      if (updateChappySource(this, b)) return;
      if (updateStarFlightSource(this, b)) return;
      if (b.delay > 0) { b.delay--; return; }
      if (b.fadeAt > 0 && b.age >= b.fadeAt) {
        if (b.motion === 'jinraiHeart') this.spark(b.x, b.y, '#ffd3e5', 7);
        b.active = false; return;
      }
      if (b.motion === 'jinraiHeart') updateJinraiHeart(b, this.px, this.py);
      if (b.motion === 'vim') updateVimBullet(b);
      if (b.motion === 'starTrail' && b.age === b.releaseAt + 1 && b.gridRow % 8 === 0 && b.sway > 0) this.audio.play('turn');
      if (b.launchSoundPending) {
        b.launchSoundPending = false;
        this.triggerBossCast();
        // 予告のdelayを通過した最初の移動フレームで、斉射をまとめて鳴らす。
        if (this.phase && this.boss && this.lastBossShotFrame !== this.frame) {
          this.lastBossShotFrame = this.frame;
          this.audio.play(this.boss === 'jinrai' && (this.phase.kind === 'normal' || this.phase.pattern === 'jinraiClone') ? 'jinraiShot' : 'enemyShot');
        }
      }
      if (b.motion === 'gridSnap') {
        if (b.age < b.releaseAt) { b.x += (b.targetX - b.x) * 0.2; b.y += (b.targetY - b.y) * 0.2; }
        else { b.x = b.targetX; b.y = b.targetY; b.vy = [0.85, 1.05, 1.25, 1.45][attackLevel]; b.motion = 'normal'; }
      }
      if (b.motion === 'etoileOrbit') {
        const angle = b.swayPhase + b.age * b.swayRate;
        b.x = b.targetX + Math.cos(angle) * 73 + Math.sin(angle) * 10;
        b.y = b.targetY + Math.sin(angle) * 24;
        if (b.age >= b.releaseAt) {
          b.motion = 'etoileFall'; b.vx = Math.cos(angle) * 0.43; b.vy = 0.36;
        } else b.color = b.age >= b.releaseAt - [70, 56, 44, 34][['easy', 'normal', 'hard', 'lunatic'].indexOf(this.difficulty)] ? 1 : 2;
      }
      if (b.motion === 'etoileFall') b.vy += 0.012;
      if (b.motion === 'etokichiRing') {
        const vx = b.vx * Math.cos(b.spin) - b.vy * Math.sin(b.spin);
        b.vy = b.vx * Math.sin(b.spin) + b.vy * Math.cos(b.spin);
        b.vx = vx;
        if (b.age >= b.releaseAt) b.motion = 'normal';
      }
      if (b.motion === 'bookshelf' && b.age === b.releaseAt) {
        b.vx *= -1;
        const level = ['easy', 'normal', 'hard', 'lunatic'].indexOf(this.difficulty);
        for (let i = -1; i <= 1; i++) this.spawnBullet(b.x, b.y + 8, i * 0.32, [0.75, 0.9, 1.05, 1.2][level], 1, 'orb');
      }
      if (b.motion === 'tagPull') {
        const [tx, ty] = tags(this.phaseFrame - 105)[b.color];
        b.vx += Math.max(-0.014, Math.min(0.014, (tx - b.x) * 0.000075));
        b.vy += Math.max(-0.01, Math.min(0.01, (ty - b.y) * 0.000045));
      }
      if (b.motion === 'sweepRadial' && b.age <= 70 && b.sway !== 0) {
        const vx = b.vx * Math.cos(b.sway) - b.vy * Math.sin(b.sway);
        b.vy = b.vx * Math.sin(b.sway) + b.vy * Math.cos(b.sway);
        b.vx = vx;
      }
      if (b.motion === 'jinraiHold' && b.releaseAt > 0 && attackFrame >= b.releaseAt) {
        const angle = Math.atan2(b.targetY - b.y, b.targetX - b.x);
        const speed = 0.95 + attackLevel * 0.14;
        b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed;
        b.motion = 'normal';
      }
      if (b.motion === 'recall') {
        if (b.age === b.gridRow) { b.vx = 0; b.vy = 0; }
        // 場外で待つ間から本体を追い、帰還先を発射地点に固定しない。
        if (b.age >= b.gridRow) [b.targetX, b.targetY] = this.bossPosition();
        if (b.age === b.releaseAt) {
          if (b.gridColumn === 0) this.audio.play('turn');
          // 戻りは星に変えるが、当たり判定は往路と同じままにする。
          b.kind = 'star';
        }
        if (b.age >= b.releaseAt) {
          if (Math.hypot(b.targetX - b.x, b.targetY - b.y) <= b.sway) {
            b.active = false; return;
          }
          const angle = Math.atan2(b.targetY - b.y, b.targetX - b.x);
          b.vx = Math.cos(angle) * b.sway; b.vy = Math.sin(angle) * b.sway;
        }
      } else if (b.motion === 'wing') b.vy += Math.sin(b.age * 0.13) * 0.003;
      if (b.motion === 'minervaRing') {
        const nextX = b.vx * Math.cos(b.spin) - b.vy * Math.sin(b.spin);
        b.vy = b.vx * Math.sin(b.spin) + b.vy * Math.cos(b.spin);
        b.vx = nextX;
        if (b.age === b.releaseAt) {
          this.audio.play('turn');
          const angle = Math.atan2(b.y - 220, b.x - 192);
          b.motion = 'normal'; b.vx = Math.cos(angle) * 0.55;
          b.vy = Math.sin(angle) * 0.55 + [1.25, 1.65, 1.95, 2.25][['easy', 'normal', 'hard', 'lunatic'].indexOf(this.difficulty)];
        }
      }
      if (b.motion === 'jinraiSakura') {
        const gustFrame = windFrame - SAKURA_WARNING[sakuraLevel];
        const swirlFrame = gustFrame - SAKURA_GUST;
        const sway = b.sway * (Math.sin(b.age * b.swayRate + b.swayPhase) - Math.sin((b.age - 1) * b.swayRate + b.swayPhase));
        b.x += b.vx + sway;
        b.rotation += b.spin;
        if (gustFrame >= 0 && gustFrame < SAKURA_GUST) {
          b.x += this.jinraiWindDirection * [1.1, 1.8, 2.4, 3.0][sakuraLevel] * Math.sin(Math.PI * gustFrame / SAKURA_GUST);
          b.rotation += this.jinraiWindDirection * 0.035;
        }
        if (swirlFrame >= 0 && swirlFrame < SAKURA_SWIRL &&
          (this.jinraiWindDirection > 0 ? b.x > FIELD.w - 90 : b.x < 90)) {
          const angle = swirlFrame * 0.21 + b.swayPhase;
          b.x += Math.cos(angle) * 1.1;
          b.y += Math.sin(angle) * 0.9 + b.vy * 0.25;
          b.rotation += 0.1;
        } else b.y += b.vy;
      } else if (b.motion !== 'etoileOrbit') {
        const bog = this.phase?.pattern === 'dotfiles' || (this.phase?.pattern === 'neoEncore' && this.encoreCount === 3);
        const bogTime = this.phase?.pattern === 'neoEncore' ? encoreBogTime(this) : this.phaseFrame - 105;
        const slow = bog && inBog(b.x, b.y, bogTime) ? 0.28 : 1;
        if (b.motion === 'complement') {
          const blue = b.x < complementBoundary(attack.phase?.pattern === 'final' ? (attackFrame - 105) % 600 : attackFrame - 105);
          b.color = blue ? 1 : 3;
          b.x += b.vx; b.y += b.vy * (blue ? 0.58 : 1.55);
        // 扇の頂点を固定すると中央の弾が上端で永久に凍る。視線は帯ごと左右へ掃く。
        } else if (b.motion !== 'eyeFreeze' || Math.abs(b.x - eyeX(this.phaseFrame - 105)) > 30) {
          b.x += b.vx * slow; b.y += b.vy * slow;
        }
      }
      if (b.motion === 'whiteSpace' && claudineScene(attack) === 'whiteSpace') {
        const local = attack.phase?.pattern === 'final' ? (attackFrame - 105) % 600 : attackFrame - 105;
        const [cx, cy, r] = whiteSpaceCircle(local);
        if (Math.hypot(b.x - cx, b.y - cy) < r + b.radius + 5) { b.active = false; return; }
      }
      if (b.split && b.age === 84) {
        for (let i = -3; i <= 3; i++) {
          const a = Math.atan2(b.vy, b.vx) + i * 0.21;
          this.spawnBullet(b.x, b.y, Math.cos(a) * 1.35, Math.sin(a) * 1.35, 1, 'needle');
        }
        b.active = false; return;
      }
      const margin = b.motion === 'wing' ? 130 : 25;
      // 宵の誘いは画面外から戻る。通常弾の画面外削除から外し、10秒の寿命で必ず回収する。
      if (b.motion !== 'jinraiHeart' && b.motion !== 'recall' && (b.x < -margin || b.x > FIELD.w + margin || b.y < -30 || b.y > FIELD.h + 25)) { b.active = false; return; }
      // 点滅中に見えない弾へ当たらないよう、消える最後の1秒は無害にする。
      if (b.motion === 'jinraiHeart' && b.age >= b.fadeAt - KISS_FADE) return;
      if (this.invulnFrames > 0 || this.invincible || this.pendingHit >= 0) return;
      const result = b.motion === 'bookshelf'
        ? (b.targetX > 0 ? this.px <= b.x + 9 : this.px >= b.x - 9) && Math.abs(this.py - b.y) < 11 ? 'hit' : 'none'
        : bulletContact(this.px, this.py, b.x, b.y, b.radius, b.grazed);
      if (result === 'hit') { this.pendingHit = 0; this.hitDuringSpell = true; }
      if (result === 'graze') { b.grazed = true; this.grazeAt(b.x, b.y); }
    });
  }

  private updateClones(): void {
    this.clones.forEach((clone) => {
      clone.age++;
      if (clone.age < 24) { clone.x += clone.vx; clone.y += clone.vy; }
      if (clone.age === 30 || clone.age === 54) {
        const angle = Math.atan2(this.py - clone.y, this.px - clone.x);
        for (let i = -1; i <= 1; i++) {
          const a = angle + i * 0.29;
          const speed = bulletSpeed(this.difficulty, 1.3);
          this.spawnBullet(clone.x, clone.y, Math.cos(a) * speed, Math.sin(a) * speed, 2, 'star');
        }
      }
      if (clone.age > 78) clone.active = false;
    });
  }

  private damageBoss(damage: number): void {
    // 印とカットインを撃ち込みで飛ばせないよう、導入中はダメージを受けない。
    if (this.phase?.pattern === 'jinraiDash' && this.phaseFrame < DASH_ATTACK) return;
    if (this.phase?.pattern === 'owlDawn' && this.minervaReprise && !this.minervaReprise.prayer && repriseLocal(this.phaseFrame, this.minervaReprise) < reprisePrepare(this.minervaReprise)) return;
    this.phaseHp -= damage * (this.phase?.pattern === 'owlDawn' ? 2 / 3 : this.phase?.pattern === 'jinraiDash' ? 2 : 1);
  }

  private updateShots(): void {
    const attack = this.attackContext();
    const letters = attack.phase?.pattern === 'enter' && this.bombFrames <= 0
      ? this.bullets.objects.filter((b) => b.active && b.motion === 'enterLine' && b.delay <= 0) : undefined;
    this.shots.forEach((s) => {
      if (s.homing && !this.held('ShiftLeft') && !this.held('ShiftRight')) {
        let target: [number, number] | undefined;
        if (this.phase) target = this.bossTargets().reduce((nearest, point) => Math.hypot(point[0] - s.x, point[1] - s.y) < Math.hypot(nearest[0] - s.x, nearest[1] - s.y) ? point : nearest);
        else this.enemies.forEach((e) => { if (!target || Math.hypot(e.x - s.x, e.y - s.y) < Math.hypot(target[0] - s.x, target[1] - s.y)) target = [e.x, e.y]; });
        if (target) s.vx += Math.max(-0.3, Math.min(0.3, (target[0] - s.x) / 55));
        s.vx = Math.max(-3, Math.min(3, s.vx));
      }
      const fromX = s.x; const fromY = s.y;
      s.x += s.vx; s.y += s.vy;
      if (letters && reflectEnterShot(attack, s, fromX, fromY, letters)) return;
      if (this.interviewRings.some((ring) => interviewRingBlocksShot(ring, fromX, fromY, s.x, s.y, s.radius))) {
        s.active = false; this.spark(s.x, s.y, '#c7ddff', 1); return;
      }
      if (s.y < -10 || s.x < -15 || s.x > FIELD.w + 15) { s.active = false; return; }
      if (this.phase && !(this.phase.pattern === 'jinraiDash' && burstVisibility(dashBurstStep(this)) < 1)) {
        if (this.bossTargets().some(([bx, by]) => circlesHit(s.x, s.y, s.radius, bx, by, 20))) {
          if (this.phase.pattern !== 'final') this.damageBoss(s.damage);
          s.active = false; this.spark(s.x, s.y, '#ffe2ac', 1); return;
        }
      }
      this.enemies.forEach((e) => {
        if (s.active && circlesHit(s.x, s.y, s.radius, e.x, e.y, 13)) { e.hp -= s.damage; e.hitFrames = 8; s.active = false; }
      });
    });
  }

  private updateEnemies(): void {
    this.enemies.forEach((e) => {
      e.age++;
      if (e.hitFrames > 0) e.hitFrames--;
      const t = e.age;
      if (e.kind === 'pincer') {
        e.x = e.originX + e.side * (t < 80 ? t * 2.2 : 176 - (t - 80) * 1.9);
        e.y = e.originY + Math.sin(t / 150 * Math.PI) * 32;
      } else if (e.kind === 'serpent') {
        e.x = e.originX + Math.sin((t - e.slot * 10) * 0.038) * 65;
        e.y = Math.min(188, e.originY + t * 2) - Math.max(0, t - 135) * 2.4;
      } else if (e.kind === 'orbit') {
        const angle = e.slot * Math.PI / 3 + e.side * t * 0.027;
        const radius = Math.min(92, t * 1.5);
        const centerY = Math.min(125, -50 + t * 2) - Math.max(0, t - 145) * 2.8;
        e.x = e.originX + Math.cos(angle) * radius;
        e.y = centerY + Math.sin(angle) * radius * 0.6;
      } else if (e.kind === 'chevron') {
        e.y = Math.min(162 - Math.ceil(e.slot / 2) * 18, e.originY + t * 1.9) - Math.max(0, t - 130) * 2.1;
        e.x = e.originX + e.side * Math.sin(t * 0.018) * 26;
      } else if (e.kind === 'cross') {
        e.x = e.originX + e.side * t * 2.25;
      } else if (e.kind === 'arc') {
        e.x = e.originX + e.side * (Math.sin(Math.min(t, 145) / 145 * Math.PI) * 126 - Math.max(0, t - 145) * 1.8);
        e.y = Math.min(150, e.originY + t * 1.55) - Math.max(0, t - 110) * 1.3;
      } else if (e.kind === 'ring') {
        e.y = Math.min(105, e.originY + t * 1.5) - Math.max(0, t - 115) * 1.9;
      } else if (e.kind === 'threeWay' || e.kind === 'sweep') {
        e.y = Math.min(e.kind === 'sweep' ? 155 : 115, e.originY + t * 1.65) - Math.max(0, t - 125) * 1.8;
        e.x = e.originX + Math.sin(t * 0.025) * 18;
      } else {
        e.y = Math.min(170, e.originY + t * 1.9) - Math.max(0, t - 120) * 2.2;
      }
      this.fireWave(e);
      if (e.hp <= 0) {
        this.addScore(1500);
        this.audio.play('kill');
        this.spark(e.x, e.y, '#f8c5ff', 12);
        const roll = Math.random();
        const kind = roll < 0.003 ? 'life' : roll < 0.013 ? 'bomb' : roll < 0.063 ? 'large' : roll < 0.72 ? 'small'
          : this.power >= MAX_POWER && !this.awakened && roll >= 0.997 ? 'radiant' : 'point';
        this.spawnItem(e.x, e.y, kind, false);
        e.active = false;
      }
      if (e.age > 260 || (e.age > 140 && e.y < -35) || (e.age > 30 && (e.x < -35 || e.x > FIELD.w + 35))) e.active = false;
      if (this.invulnFrames === 0 && !this.invincible && this.pendingHit < 0 && circlesHit(this.px, this.py, 2.5, e.x, e.y, 12)) this.pendingHit = 0;
    });
  }

  private fireWave(e: Enemy): void {
    if (!enemyFireFrames(e, this.stage).includes(e.age) || Math.hypot(this.px - e.x, this.py - e.y) < 150) return;
    const aimed = Math.atan2(this.py - e.y, this.px - e.x);
    const speed = bulletSpeed(this.difficulty, 1.05);
    const fire = (angle: number) => this.spawnBullet(e.x, e.y, Math.cos(angle) * speed, Math.sin(angle) * speed, e.color);
    if (e.kind === 'pincer' || e.kind === 'serpent' || e.kind === 'orbit' || e.kind === 'chevron') {
      if (e.kind === 'pincer') {
        for (let i = 0; i < (this.stage >= 4 ? 3 : 2); i++) fire(Math.PI / 2 - e.side * (0.18 + i * 0.2));
      } else if (e.kind === 'orbit') {
        const angle = Math.PI / 2 + Math.sin(e.slot * Math.PI / 3 + e.side * e.age * 0.027) * 0.65;
        for (let i = 0; i < (this.stage >= 4 ? 3 : 2); i++) fire(angle + (i - 0.5) * 0.16);
      } else if (e.kind === 'serpent') {
        for (let i = 0; i < (this.stage >= 4 ? 3 : 2); i++) fire(Math.PI / 2 + Math.sin(e.age * 0.038) * 0.45 + (i - 0.5) * 0.2);
      } else {
        const spread = this.stage >= 4 ? 3 : 2;
        for (let i = 0; i < spread; i++) fire(aimed + (i - (spread - 1) / 2) * 0.19);
      }
      return;
    }
    if (e.kind === 'cross' && (e.age === 65 || e.age === 125)) {
      this.spawnBullet(e.x, e.y, 0, bulletSpeed(this.difficulty, 0.72), e.color, 'petal');
      if (this.stage >= 3) this.spawnBullet(e.x, e.y, e.side * 0.22, bulletSpeed(this.difficulty, 0.76), e.color, 'petal');
      return;
    }
    if (e.kind === 'ring' && e.age === 98) {
      const count = density(this.difficulty, this.stage === 1 ? 8 : this.stage === 2 ? 10 : 10 + this.stage * 2);
      for (let i = 0; i < count; i++) fire(i * Math.PI * 2 / count + 0.14);
      return;
    }
    if (this.stage <= 2 && e.slot === 6) return;
    if (e.slot > 0 && e.age === 92) {
      const spread = this.stage === 5 ? 4 : this.stage >= 4 ? 3 : 2;
      for (let i = 0; i < spread; i++) {
        const vx = (i - (spread - 1) / 2) * 0.24 + (e.slot % 2 ? 0.12 : -0.12);
        this.spawnBullet(e.x, e.y, vx, bulletSpeed(this.difficulty, 0.82), e.color, 'petal');
      }
      return;
    }
    if (e.slot !== 0) return;
    if (e.kind === 'threeWay' && e.age === 95) {
      for (const offset of [-0.18, 0, 0.18]) fire(aimed + offset);
    } else if (e.kind === 'sweep' && (e.age === 88 || e.age === 113)) {
      fire(aimed);
    } else if ((e.kind === 'arc' || e.kind === 'return') && e.age === 100) {
      fire(aimed);
    }
  }

  spawnItem(x: number, y: number, kind: ItemKind, auto: boolean): Item | undefined {
    const item = this.items.acquire(); if (!item) return;
    Object.assign(item, { x, y, vx: (Math.random() - 0.5) * 1.2, vy: -1.2, kind, auto, manual: false, gift: false, tossed: false, launchFrames: 0 });
    return item;
  }

  private updateItems(): void {
    const focused = this.held('ShiftLeft') || this.held('ShiftRight');
    this.items.forEach((item) => {
      const dist = Math.hypot(item.x - this.px, item.y - this.py);
      const launching = item.launchFrames > 0;
      const seeking = item.auto || (!item.manual && autoCollect(this.py)) || dist < (focused ? 84 : 37);
      if (launching) { item.launchFrames--; item.vy += 0.09; }
      else if (seeking) {
        const rate = item.auto ? 0.22 : 0.16;
        item.vx += (this.px - item.x) * rate / 10;
        item.vy += (this.py - item.y) * rate / 10;
        item.vx *= 0.92; item.vy *= 0.92;
        // 投げた報酬は遠距離でも加速しすぎず、通常の回収に近い速さで寄せる。
        if (item.tossed) {
          const speed = Math.hypot(item.vx, item.vy);
          if (speed > 4) { item.vx *= 4 / speed; item.vy *= 4 / speed; }
        }
      } else item.vy = Math.min(2.2, item.vy + 0.035);
      item.x += item.vx; item.y += item.vy;
      if (item.manual && (item.x < 12 || item.x > FIELD.w - 12)) {
        item.x = Math.max(12, Math.min(FIELD.w - 12, item.x));
        item.vx *= -1;
      }
      if (item.y > FIELD.h + 20 || (item.tossed && (item.x < -20 || item.x > FIELD.w + 20 || item.y < -20))) { item.active = false; return; }
      if (!launching && dist < 11) { this.collectItem(item); item.active = false; }
    });
  }

  private collectItem(item: Pick<Item, 'kind' | 'y' | 'gift'>): void {
    this.audio.play('item');
    switch (item.kind) {
      case 'small': this.power = Math.min(MAX_POWER, Math.round((this.power + 0.05) * 100) / 100); this.addScore(100); break;
      case 'large': this.power = Math.min(MAX_POWER, this.power + 1); break;
      case 'point': this.addScore(pointValue(item.y, this.point)); break;
      case 'bomb': this.bombs = Math.min(MAX_BOMBS, this.bombs + 1); break;
      case 'life': this.lives++; this.audio.play('extend'); break;
      case 'radiant':
        if (item.gift) this.power = MAX_POWER;
        // 被弾前に落ちた羽根でも、Powerを戻すだけで最高形態が復活しないようにする。
        if (this.power < MAX_POWER) this.power = Math.min(MAX_POWER, this.power + 1);
        else if (this.awakened) this.addScore(this.point);
        else {
          this.awakened = true;
          this.spark(this.px, this.py, '#ffe39a', 45);
          this.audio.play('extend');
          this.message = '光の羽根'; this.messageFrames = 100;
        }
        break;
    }
  }

  private addScore(value: number): void {
    const old = this.score;
    this.score += Math.round(value);
    const gained = newExtends(old, this.score);
    if (gained) { this.lives += gained; this.audio.play('extend'); this.message = 'EXTEND!'; this.messageFrames = 100; }
    if (this.score > this.highScore) { this.highScore = this.score; safeSave(`owlery-high-${this.difficulty}`, String(this.highScore)); }
  }

  spark(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles.acquire(); if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const speed = 0.6 + Math.random() * 2;
      Object.assign(p, { x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, age: 0, life: 18 + Math.random() * 18, color, size: 1 + Math.random() * 3 });
    }
  }

  private updateParticles(): void {
    this.particles.forEach((particle) => { particle.x += particle.vx; particle.y += particle.vy; particle.age++; if (particle.age >= particle.life) particle.active = false; });
  }

  private calculateClearBonus(): number {
    return this.stage * 1_000_000 + this.lives * 200_000 + this.bombs * 60_000 + Math.floor(this.power * 100_000) + this.point * 10 + this.graze * 100;
  }

  private finishStage(bonus = this.calculateClearBonus()): void {
    this.postBoss = false;
    this.clearBonus = bonus;
    this.addScore(this.clearBonus);
    this.unlocked = Math.max(this.unlocked, Math.min(STAGES.length, this.stage + 1));
    safeSave('owlery-unlocked', String(this.unlocked));
    if (!this.collectedRecords.includes(this.stage)) {
      this.collectedRecords.push(this.stage);
      this.collectedRecords.sort((a, b) => a - b);
      safeSave('owlery-records', this.collectedRecords.join(','));
    }
    this.scene = 'clear';
  }

  get debugState(): Record<string, string | number | null> {
    const audio = { bgmVolume: this.bgm.effectiveVolume };
    const effects = { ...audio, bgmMultiplier: this.bgm.sceneVolumeMultiplier, movie: this.movieName ?? null, stageFrame: this.stageFrame, stageIntroFrame: this.stageIntroFrame, arrivalFrame: this.arrivalFrame, transition: this.transition ?? null, transitionFrame: this.transitionFrame, whiteAlpha: this.whiteAlpha, departureFrame: this.departureFrame, items: this.items.count, giftFrame: this.giftFrame, giftItems: this.items.objects.filter((item) => item.active && item.gift).length, phaseFrame: this.phaseFrame, endingFrame: this.endingFrame, creditsFrame: this.creditsFrame };
    return { ...effects, scene: this.scene, stage: this.stage, boss: this.boss ? NAMES[this.boss] : null, bossRole: this.boss ? this.midboss ? 'midboss' : 'boss' : null, phase: this.phase ? this.phaseIndex : -1, spell: this.phase?.spell ? this.phase.name : null, phaseRemainingSeconds: this.phase ? Number.isFinite(this.phase.duration) ? Math.max(0, (this.phase.duration * 60 - this.phaseFrame) / 60) : '∞' : null, phaseHpRatio: this.phase ? Math.max(0, this.phaseHp / this.phaseMaxHp) : null, bullets: this.bullets.count, graphNodes: this.graphNodes.length, graphEdges: this.graphEdges.length, reprise: this.minervaReprise ? REPRISES[this.minervaReprise.index].phase.name : null, score: this.score, power: this.power, maxform: Number(this.awakened), lives: this.lives, bombs: this.bombs, fps: this.fps, bgm: this.bgm.cue };
  }

  get endingLines(): string[] { return ENDINGS[this.player]; }
}
