import type { BgmCue } from './bgm';
import type { MovieName } from './movies';

export type MediaKey = `bgm:${BgmCue}` | `movie:${MovieName}` | 'sound:jinrai-warp';
interface Entry { controller: AbortController; promise: Promise<Blob>; blob?: Blob; url?: string; bytes: number; }

// 圧縮データだけを保持する。展開と動画デコーダーの寿命は各プレイヤーが持つ。
export class MediaAssets {
  private readonly entries = new Map<MediaKey, Entry>();
  private allowed = new Set<MediaKey>();
  private readonly skipped = new Set<MediaKey>();

  constructor(private readonly fetcher: typeof fetch = (input, init) => fetch(input, init), private readonly idleMs = 15_000) {}

  retain(keys: readonly MediaKey[]): void {
    this.allowed = new Set(keys);
    for (const key of this.entries.keys()) if (!this.allowed.has(key)) this.remove(key);
    for (const key of this.skipped) if (!this.allowed.has(key)) this.skipped.delete(key);
  }

  has(key: MediaKey): boolean { return this.skipped.has(key) || !!this.entries.get(key)?.blob; }
  isSkipped(key: MediaKey): boolean { return this.skipped.has(key); }
  unskip(keys: readonly MediaKey[]): void { for (const key of keys) this.skipped.delete(key); }
  skip(keys: readonly MediaKey[]): void { for (const key of keys) { this.remove(key); this.skipped.add(key); } }
  retry(keys: readonly MediaKey[]): void { for (const key of keys) { this.skipped.delete(key); this.remove(key); } }

  load(key: MediaKey): Promise<Blob> {
    if (!this.allowed.has(key)) return Promise.reject(new DOMException('Media released', 'AbortError'));
    const cached = this.entries.get(key);
    if (cached) return cached.promise;
    const controller = new AbortController();
    const entry: Entry = { controller, promise: Promise.resolve(new Blob()), bytes: 0 };
    entry.promise = this.download(key, entry).then(blob => {
      if (this.entries.get(key) !== entry) throw new DOMException('Media released', 'AbortError');
      entry.blob = blob; entry.bytes = blob.size;
      return blob;
    }).catch(error => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, entry);
    return entry.promise;
  }

  async prefetch(keys: readonly MediaKey[]): Promise<void> {
    for (const key of keys) {
      if (!this.allowed.has(key)) return;
      if (!this.has(key)) { try { await this.load(key); } catch { /* 前景の準備確認で再試行する */ } }
    }
  }

  objectUrl(key: MediaKey): string | undefined {
    if (this.skipped.has(key)) return undefined;
    const entry = this.entries.get(key);
    if (!entry?.blob) return undefined;
    entry.url ??= URL.createObjectURL(entry.blob);
    return entry.url;
  }

  remove(key: MediaKey): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key); entry.controller.abort();
    if (entry.url) URL.revokeObjectURL(entry.url);
  }

  progress(keys: readonly MediaKey[]): { complete: number; total: number; bytes: number } {
    return { complete: keys.filter(key => this.has(key)).length, total: keys.length, bytes: keys.reduce((sum, key) => sum + (this.entries.get(key)?.bytes ?? 0), 0) };
  }

  get diagnostics(): { files: number; bytes: number; downloading: number } {
    return { files: this.entries.size, bytes: [...this.entries.values()].reduce((sum, entry) => sum + entry.bytes, 0), downloading: [...this.entries.values()].filter(entry => !entry.blob).length };
  }

  private async download(key: MediaKey, entry: Entry): Promise<Blob> {
    const [kind, name] = key.split(':');
    const folder = kind === 'bgm' ? 'bgm' : kind === 'movie' ? 'movies' : 'audio';
    const extension = kind === 'movie' ? 'mp4' : 'mp3';
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => entry.controller.abort(), this.idleMs); };
    try {
      reset();
      const response = await this.fetcher(`${import.meta.env.BASE_URL}assets/${folder}/${name}.${extension}`, { signal: entry.controller.signal });
      if (!response.ok) throw new Error(`Media HTTP ${response.status}`);
      const type = kind === 'movie' ? 'video/mp4' : 'audio/mpeg';
      if (!response.body) {
        const blob = await response.blob();
        if (!blob.size) throw new Error('Empty media');
        return blob;
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reset(); entry.bytes += value.byteLength; chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      if (!entry.bytes) throw new Error('Empty media');
      const expected = Number(response.headers.get('Content-Length'));
      if (expected > 0 && entry.bytes !== expected && !response.headers.get('Content-Encoding')) throw new Error('Incomplete media');
      return new Blob(chunks, { type });
    } finally { clearTimeout(timer!); }
  }
}
