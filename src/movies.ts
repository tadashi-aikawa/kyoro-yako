export const MOVIES = ['opening', 'lastboss', 'jinrai-gift', 'ending-1', 'ending-2', 'ending-3'] as const;
export type MovieName = typeof MOVIES[number];
export const MOVIE_SETTINGS: Record<MovieName, { audio: boolean }> = {
  opening: { audio: true },
  lastboss: { audio: false },
  'jinrai-gift': { audio: false },
  'ending-1': { audio: false },
  'ending-2': { audio: false },
  'ending-3': { audio: false },
};
export const ENDING_MOVIES: MovieName[] = ['ending-1', 'ending-2', 'ending-3'];

export class MoviePlayer {
  private readonly videos = new Map<MovieName, HTMLVideoElement>();
  // 未配置でもタイトルに戻るたび404を出さない。
  private readonly failed = new Set<MovieName>();
  private cancel?: () => void;
  private volume = 0.6;
  current?: HTMLVideoElement;

  constructor(private readonly audioDisabled = false) {}

  usesAudio(name: MovieName): boolean {
    return !this.audioDisabled && MOVIE_SETTINGS[name].audio && !this.current?.muted;
  }

  setVolume(percent: number): void {
    const volume = Math.max(0, Math.min(100, percent)) / 100;
    if (volume === this.volume) return;
    this.volume = volume;
    for (const video of this.videos.values()) video.volume = volume;
  }

  preload(names: readonly MovieName[]): void { for (const name of names) this.video(name); }

  private video(name: MovieName): HTMLVideoElement | undefined {
    if (this.failed.has(name) || typeof document === 'undefined') return undefined;
    const cached = this.videos.get(name);
    if (cached) return cached;
    const video = document.createElement('video');
    video.muted = this.audioDisabled || !MOVIE_SETTINGS[name].audio;
    video.volume = this.volume;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('error', () => this.failed.add(name));
    video.src = `${import.meta.env.BASE_URL}assets/movies/${name}.mp4`;
    this.videos.set(name, video);
    return video;
  }

  play(name: MovieName, done: () => void): void {
    this.stop();
    const video = this.video(name);
    if (!video || video.error) { done(); return; }
    video.muted = this.audioDisabled || !MOVIE_SETTINGS[name].audio;
    this.current = video;
    let active = true;
    let starting = false;
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      active = false;
      clearTimeout(timer);
      for (const [event, handler] of Object.entries(handlers)) video.removeEventListener(event, handler);
      video.pause();
      this.current = undefined;
      this.cancel = undefined;
    };
    const finish = () => { if (active) { cleanup(); done(); } };
    const timeout = () => { clearTimeout(timer); timer = setTimeout(finish, 1000); };
    const rejected = (error: unknown) => {
      if (!active) return;
      if (!video.muted && typeof error === 'object' && error !== null && 'name' in error && error.name === 'NotAllowedError') {
        video.muted = true;
        play();
      } else finish();
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
      } catch { finish(); }
    };
    const handlers: Record<string, () => void> = { canplay: start, playing: () => clearTimeout(timer), waiting: timeout, ended: finish, error: finish };
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
