import type { AudioBank } from './audio';
import type { BgmCue, BgmPlayer } from './bgm';
import { ENDING_IMAGES, GameImages, stageImages, TITLE_IMAGES } from './game-images';
import { MediaAssets, type MediaKey } from './media-assets';
import type { MovieName, MoviePlayer } from './movies';
import { STAGES } from './stages';

export function stageMedia(stage: number): MediaKey[] {
  const definition = STAGES[stage - 1];
  if (!definition) return [];
  const keys: MediaKey[] = [`bgm:${definition.bgm}`, `bgm:boss-${definition.boss}` as MediaKey, ...stageImages(stage)];
  if (stage === 4) keys.push('sound:jinrai-warp', 'movie:jinrai-gift');
  if (stage === 5) keys.push('movie:lastboss', 'movie:minerva-finale', 'movie:ending', 'bgm:ending');
  return keys;
}

interface Job { cue: BgmCue | null; movie?: MovieName; keys: MediaKey[]; failed: Set<MediaKey>; phase: 'download' | 'audio' | 'video'; downloading?: boolean; startedAt?: number; onReady?: () => void; }
const musicLabels: Record<BgmCue, string> = {
  title: 'タイトルの音楽', 'stage-gate': '梟楼の門の音楽', 'boss-neo': 'ネオの音楽',
  'stage-archive': '書庫の音楽', 'boss-obsidia': 'オブシディアの音楽', 'stage-top': '回廊の音楽',
  'boss-claudine': 'クロディーヌの音楽', 'stage-sakura': '夜桜の音楽', 'boss-jinrai': '迅雷の音楽',
  'stage-dawn': '天文台の音楽', 'boss-minerva': 'ミネルヴァの音楽', ending: 'エンディングの音楽',
};
const movieLabels: Record<MovieName, string> = { opening: '旅立ちの映像', lastboss: 'ミネルヴァ登場の映像', 'jinrai-gift': '迅雷の贈り物の映像', 'minerva-finale': 'ミネルヴァの最後の映像', ending: 'エンディングの映像' };
export function mediaLabel(key: MediaKey): string {
  if (key.startsWith('image:')) {
    if (key === 'image:title') return 'タイトルの画像';
    if (key.startsWith('image:credits-')) return 'スタッフロールの画像';
    if (key.endsWith('-ultimate')) return '必殺技の画像';
    return 'キャラクターの画像';
  }
  if (key.startsWith('bgm:')) return musicLabels[key.slice(4) as BgmCue];
  if (key.startsWith('movie:')) return movieLabels[key.slice(6) as MovieName];
  return '迅雷の瞬間移動音';
}

export class GameMedia {
  readonly assets: MediaAssets;
  readonly images: GameImages;
  stage?: number;
  menu = 0;
  private needed: MediaKey[] = [];
  private next: MediaKey[] = [];
  private job?: Job;
  private bgm!: BgmPlayer;
  private movies!: MoviePlayer;
  private audio!: AudioBank;
  private titlePreparing?: Promise<void>;
  private titleFailed = false;
  private scope = 0;
  private pairPrepared = false;

  constructor(assets = new MediaAssets()) { this.assets = assets; this.images = new GameImages(assets); }

  attach(bgm: BgmPlayer, movies: MoviePlayer, audio: AudioBank): void {
    this.bgm = bgm; this.movies = movies; this.audio = audio;
    movies.onError = (movie, retry) => {
      this.releaseMovie(movie);
      this.job = { cue: this.bgm.cue, movie, keys: this.keys(this.bgm.cue, movie), failed: new Set<MediaKey>([`movie:${movie}`]), phase: 'video', onReady: retry };
      this.menu = 0;
    };
  }

  enterTitle(): void {
    this.scope++;
    this.stage = undefined; this.job = undefined; this.needed = [...TITLE_IMAGES]; this.next = [];
    this.titleFailed = false;
    this.movies.retain([]); this.audio.releaseStageSound(); this.bgm.retain(['title']);
    if (this.bgm.cue !== 'title') this.bgm.sync(null, false);
    this.images.retain(this.needed);
    this.assets.retain(['bgm:title', 'movie:opening', ...this.needed]);
    if (!this.needed.every(key => this.ready(key))) this.start({ cue: null, keys: this.needed, failed: new Set(), phase: 'download' });
  }

  enterStage(stage: number, opening = false): void {
    this.scope++; this.pairPrepared = false;
    this.stage = stage; this.job = undefined;
    this.needed = this.filter(stageMedia(stage));
    if (opening) this.needed.push('movie:opening');
    this.next = this.filter(stageMedia(stage + 1));
    const allowed = [...this.needed, ...this.next];
    this.movies.retain(this.needed.filter(key => key.startsWith('movie:')).map(key => key.slice(6) as MovieName));
    this.bgm.retain(this.needed.filter(key => key.startsWith('bgm:')).map(key => key.slice(4) as BgmCue));
    if (stage !== 4) this.audio.releaseStageSound();
    this.images.retain(this.needed);
    this.assets.retain(allowed); this.assets.unskip(this.needed);
  }

  enterEnding(): void {
    this.needed = [...this.needed.filter(key => !key.startsWith('image:')), ...ENDING_IMAGES];
    const allowed = [...this.needed, ...this.next];
    this.images.retain(this.needed); this.assets.retain(allowed);
  }

  ensure(cue: BgmCue | null, movie?: MovieName, onReady?: () => void): boolean {
    if (this.stage === undefined && !movie) {
      // タイトル曲の障害は操作を妨げないが、必須画像は表示前に待つ。
      if (!this.needed.every(key => this.ready(key))) {
        if (!this.job) this.start({ cue: null, keys: this.needed, failed: new Set(), phase: 'download' });
        return false;
      }
      if (cue && !this.bgm.ready(cue) && !this.titlePreparing && !this.titleFailed) {
        const scope = this.scope;
        this.titlePreparing = this.bgm.prepare(cue).catch(() => { if (scope === this.scope) this.titleFailed = true; }).finally(() => { this.titlePreparing = undefined; });
      }
      if (this.titleFailed) this.bgm.sync(null, false);
      return !cue || this.bgm.ready(cue);
    }
    if (this.job?.cue === cue && this.job.movie === movie) { if (onReady) this.job.onReady = onReady; return false; }
    this.job = undefined;
    const keys = this.keys(cue, movie);
    const pairReady = this.pairPrepared || this.stageCues().every(key => this.bgm.ready(key));
    if (keys.every(key => this.ready(key)) && pairReady && (!cue || this.bgm.ready(cue)) && (!movie || this.movies.ready(movie)) && (this.stage !== 4 || this.audio.stageSoundReady)) return true;
    this.start({ cue, movie, keys, failed: new Set(), phase: 'download', onReady });
    return false;
  }

  get loading(): boolean { return !!this.job; }
  // 取得中に失敗対象が増えて、操作中の選択肢が変わらないよう実行中の試行の終了を待つ。
  get failed(): boolean { return !!this.job?.failed.size && !this.job.downloading; }
  get failureChoices(): readonly ('retry' | 'skip' | 'title')[] {
    const imageFailed = [...this.job?.failed ?? []].some(key => key.startsWith('image:'));
    return this.stage === undefined ? ['retry'] : imageFailed ? ['retry', 'title'] : ['retry', 'skip', 'title'];
  }
  get elapsedMs(): number { return this.job?.startedAt === undefined ? 0 : performance.now() - this.job.startedAt; }
  get state(): { complete: number; total: number; bytes: number; failures: string[]; phase: string } | undefined {
    const job = this.job;
    return job ? { ...this.assets.progress(job.keys), complete: job.keys.filter(key => this.ready(key)).length, failures: [...new Set([...job.failed].map(mediaLabel))], phase: job.phase } : undefined;
  }

  retry(): void {
    const job = this.job;
    if (!job?.failed.size) return;
    for (const key of job.failed) if (key.startsWith('movie:')) this.movies.release(key.slice(6) as MovieName);
    this.assets.retry([...job.failed]);
    this.start({ ...job, failed: new Set(), phase: 'download' });
  }

  warmCue(cue: BgmCue): void { void this.bgm.prepare(cue).catch(() => { /* 必要になる場面の準備確認で再試行する */ }); }

  skip(): void {
    const job = this.job;
    if (!job?.failed.size || !this.failureChoices.includes('skip')) return;
    for (const key of job.failed) if (key.startsWith('movie:')) this.movies.release(key.slice(6) as MovieName);
    this.assets.skip([...job.failed]);
    this.start({ ...job, failed: new Set(), phase: 'download' });
  }

  private filter(keys: MediaKey[]): MediaKey[] { return keys.filter(key => !key.startsWith('bgm:') || this.bgm.enabled); }
  private keys(cue: BgmCue | null, movie?: MovieName): MediaKey[] {
    return [...new Set([...this.needed, ...(cue && this.bgm.enabled && this.bgm.available ? [`bgm:${cue}` as MediaKey] : []), ...(movie ? [`movie:${movie}` as MediaKey] : [])])];
  }

  private stageCues(): BgmCue[] {
    return this.stage && this.bgm.enabled ? [STAGES[this.stage - 1].bgm, `boss-${STAGES[this.stage - 1].boss}` as BgmCue] : [];
  }

  private start(job: Job): void { job.startedAt = performance.now(); job.downloading = true; this.job = job; this.menu = 0; void this.run(job); }
  private ready(key: MediaKey): boolean { return key.startsWith('image:') ? this.images.ready(key) : this.assets.has(key); }

  private async run(job: Job): Promise<void> {
    const load = async (key: MediaKey): Promise<void> => {
      if (this.ready(key)) return;
      for (let attempt = 0; attempt < 3 && this.job === job; attempt++) {
        try {
          await this.assets.load(key);
          if (this.job !== job) return;
          if (key.startsWith('image:')) await this.images.prepare(key);
          return;
        }
        catch { if (attempt === 2) job.failed.add(key); }
      }
    };
    // HTTP/1.1の接続待ちを無通信と誤認しないよう、要求を絞り画像から用意する。
    const keys = [...job.keys].sort((a, b) => Number(b.startsWith('image:')) - Number(a.startsWith('image:')));
    let index = 0;
    await Promise.all(Array.from({ length: Math.min(4, keys.length) }, async () => {
      while (this.job === job && !job.failed.size && index < keys.length) await load(keys[index++]);
    }));
    job.downloading = false;
    if (this.job !== job || job.failed.size) return;
    job.phase = 'audio';
    if (!this.pairPrepared && this.bgm.available) {
      try {
        await this.bgm.prepareStage(this.stageCues());
        if (this.job !== job) return;
        this.pairPrepared = true;
      } catch {
        for (const cue of this.stageCues()) if (!this.bgm.ready(cue)) job.failed.add(`bgm:${cue}`);
      }
    }
    if (this.job !== job || job.failed.size) return;
    if (job.cue && !this.bgm.ready(job.cue)) {
      try { await this.bgm.prepare(job.cue); } catch { job.failed.add(`bgm:${job.cue}`); }
    }
    if (this.stage === 4) {
      try { await this.audio.prepareStageSound(); } catch { job.failed.add('sound:jinrai-warp'); }
    }
    if (this.job !== job || job.failed.size) return;
    if (job.movie) {
      job.phase = 'video';
      try { await this.movies.prepare(job.movie); } catch { job.failed.add(`movie:${job.movie}`); }
    }
    if (this.job !== job || job.failed.size) return;
    this.job = undefined;
    job.onReady?.();
    void this.assets.prefetch(this.stage === undefined ? ['bgm:title', 'movie:opening'] : this.next);
  }

  private releaseMovie(movie: MovieName): void { this.movies.release(movie); this.assets.remove(`movie:${movie}`); }
}
