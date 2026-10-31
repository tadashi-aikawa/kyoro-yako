import type { MediaAssets } from './media-assets';

export const MOVIES = ['opening', 'lastboss', 'jinrai-gift', 'minerva-finale', 'ending'] as const;
export type MovieName = typeof MOVIES[number];
export const MOVIE_SETTINGS: Record<MovieName, { audio: boolean }> = {
  opening: { audio: true },
  lastboss: { audio: false },
  'jinrai-gift': { audio: false },
  'minerva-finale': { audio: false },
  ending: { audio: false },
};
// 3本の間の白フェードと余韻は編集済み動画に含め、読み込みの切れ目を作らない。
export const ENDING_MOVIES: MovieName[] = ['ending'];

export class MoviePlayer {
  private readonly videos = new Map<MovieName, HTMLVideoElement>();
  private readonly preparations = new Map<MovieName, () => void>();
  private cancel?: () => void;
  private volume = 0.6;
  current?: HTMLVideoElement;

  onError?: (name: MovieName, retry: () => void, skip: () => void) => void;

  constructor(private readonly audioDisabled = false, private readonly assets?: MediaAssets) {}

  usesAudio(name: MovieName): boolean {
    return !this.audioDisabled && MOVIE_SETTINGS[name].audio && !this.current?.muted;
  }

  setVolume(percent: number): void {
    const volume = Math.max(0, Math.min(100, percent)) / 100;
    if (volume === this.volume) return;
    this.volume = volume;
    for (const video of this.videos.values()) video.volume = volume;
  }

  preload(names: readonly MovieName[]): void { if (!this.assets) for (const name of names) this.video(name); }
  ready(name: MovieName): boolean {
    const video = this.videos.get(name);
    return !!this.assets?.isSkipped(`movie:${name}`) || (!!video && video === this.current) || (video?.readyState ?? 0) >= 2;
  }

  retain(names: readonly MovieName[]): void {
    for (const name of this.videos.keys()) if (!names.includes(name)) this.release(name);
  }

  release(name: MovieName): void {
    this.preparations.get(name)?.();
    const video = this.videos.get(name);
    if (!video) return;
    if (this.current === video) this.stop();
    video.pause(); video.removeAttribute('src'); video.load();
    this.videos.delete(name);
  }

  async prepare(name: MovieName): Promise<void> {
    if (this.assets?.isSkipped(`movie:${name}`)) return;
    const video = this.video(name);
    if (!video) throw new Error('Movie not downloaded');
    if (video.error) throw new Error('Movie decoder unavailable');
    if (video.readyState >= 2) return;
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer); video.removeEventListener('canplay', ready); video.removeEventListener('error', failed); this.preparations.delete(name);
      };
      const ready = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('Unable to prepare movie')); };
      const timer = setTimeout(failed, 15_000);
      video.addEventListener('canplay', ready); video.addEventListener('error', failed);
      this.preparations.set(name, failed);
    });
  }

  private video(name: MovieName): HTMLVideoElement | undefined {
    if (typeof document === 'undefined' || this.assets?.isSkipped(`movie:${name}`)) return undefined;
    const cached = this.videos.get(name);
    if (cached) return cached;
    const video = document.createElement('video');
    video.muted = this.audioDisabled || !MOVIE_SETTINGS[name].audio;
    video.volume = this.volume;
    video.playsInline = true;
    video.preload = 'auto';
    const src = this.assets ? this.assets.objectUrl(`movie:${name}`) : `${import.meta.env.BASE_URL}assets/movies/${name}.mp4`;
    if (!src) return undefined;
    video.src = src;
    this.videos.set(name, video);
    return video;
  }

  play(name: MovieName, done: () => void, holdLastFrame = false): void {
    this.stop();
    const video = this.video(name);
    if (!video) { done(); return; }
    if (video.error) {
      if (this.onError) this.onError(name, () => this.play(name, done, holdLastFrame), done);
      else done();
      return;
    }
    video.muted = this.audioDisabled || !MOVIE_SETTINGS[name].audio;
    this.current = video;
    let active = true;
    let starting = false;
    let resuming = false;
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      active = false;
      clearTimeout(timer);
      for (const [event, handler] of Object.entries(handlers)) video.removeEventListener(event, handler);
      video.pause();
      this.current = undefined;
      this.cancel = undefined;
    };
    const finish = () => { if (active) { cleanup(); if (holdLastFrame) this.current = video; done(); } };
    const failed = () => {
      if (!active) return;
      if (!this.onError) { finish(); return; }
      cleanup();
      this.onError(name, () => this.play(name, done, holdLastFrame), done);
    };
    const timeout = () => { clearTimeout(timer); timer = setTimeout(failed, this.assets ? 15_000 : 1000); };
    const rejected = (error: unknown) => {
      if (!active) return;
      if (!video.muted && typeof error === 'object' && error !== null && 'name' in error && error.name === 'NotAllowedError') {
        video.muted = true;
        play();
      } else failed();
    };
    const play = () => {
      try { void video.play().then(() => { if (active) clearTimeout(timer); }).catch(rejected); }
      catch (error) { rejected(error); }
    };
    const start = () => {
      if (!active || starting) return;
      starting = true;
      try {
        video.currentTime = 0;
        play();
      } catch { failed(); }
    };
    const resume = () => {
      if (!active || video.ended || resuming) return;
      resuming = true;
      timeout();
      try { void video.play().then(() => { resuming = false; if (active) clearTimeout(timer); }).catch(failed); }
      catch { failed(); }
    };
    const handlers: Record<string, () => void> = { canplay: start, playing: () => clearTimeout(timer), waiting: timeout, pause: resume, ended: finish, error: failed };
    for (const [event, handler] of Object.entries(handlers)) video.addEventListener(event, handler);
    this.cancel = cleanup;
    timeout();
    if (video.readyState >= 2) start();
  }

  freeze(): void {
    const video = this.current;
    this.stop();
    this.current = video;
  }

  stop(): void { this.cancel?.(); this.current?.pause(); this.current = undefined; }
}

