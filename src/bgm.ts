import { ENDING_MUSIC_PLAYS } from './ending';
import type { MediaAssets } from './media-assets';

export type BgmCue = 'title' | 'stage-gate' | 'boss-neo' | 'stage-archive' | 'boss-obsidia' | 'stage-sakura' | 'boss-jinrai' | 'stage-top' | 'boss-claudine' | 'stage-dawn' | 'boss-minerva' | 'ending';

export interface LoopRange { start: number; end: number; }

// 5msごとのピークで端の無音を探す。短い音を挟む無音同士は結合する。
export function detectLoopRange(buffer: Pick<AudioBuffer, 'length' | 'numberOfChannels' | 'sampleRate' | 'getChannelData'>): LoopRange {
  const blockFrames = Math.max(1, Math.round(buffer.sampleRate * 0.005));
  const minSilenceFrames = Math.ceil(buffer.sampleRate * 0.3);
  const maxBridgeFrames = Math.round(buffer.sampleRate * 0.2);
  const threshold = 10 ** (-45 / 20);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  if (channels.length === 0 || buffer.length === 0) return { start: 0, end: 0 };
  const blockCount = Math.ceil(buffer.length / blockFrames);
  const silent = (block: number): boolean => {
    const from = block * blockFrames;
    const to = Math.min(buffer.length, from + blockFrames);
    for (const channel of channels) for (let frame = from; frame < to; frame++) {
      if (Math.abs(channel[frame]) >= threshold) return false;
    }
    return true;
  };
  const edgeSilence = (reverse: boolean): number => {
    const step = reverse ? -1 : 1;
    let block = reverse ? blockCount - 1 : 0;
    const inRange = () => block >= 0 && block < blockCount;
    const consume = (quiet: boolean, cap = Infinity): number => {
      let frames = 0;
      while (inRange() && silent(block) === quiet && frames <= cap) {
        frames += Math.min(blockFrames, buffer.length - block * blockFrames);
        block += step;
      }
      return frames;
    };
    let trimmed = consume(true);
    if (trimmed < minSilenceFrames) return 0;
    while (inRange()) {
      let bridge = 0;
      let found = false;
      while (inRange() && bridge <= maxBridgeFrames) {
        bridge += consume(false, maxBridgeFrames - bridge);
        if (bridge > maxBridgeFrames || !inRange()) break;
        const quiet = consume(true);
        if (quiet >= minSilenceFrames) {
          trimmed += bridge + quiet;
          found = true;
          break;
        }
        bridge += quiet;
      }
      if (!found) break;
    }
    return trimmed;
  };
  const leadingFrames = edgeSilence(false);
  const trailingFrames = edgeSilence(true);
  const startFrame = leadingFrames;
  const endFrame = buffer.length - trailingFrames;
  if (endFrame <= startFrame) return { start: 0, end: buffer.length / buffer.sampleRate };
  return { start: startFrame / buffer.sampleRate, end: endFrame / buffer.sampleRate };
}

interface Track { buffer: AudioBuffer; range: LoopRange; }

interface Voice {
  cue: BgmCue;
  bus: GainNode;
  track: Track;
  sources: Map<AudioBufferSourceNode, GainNode>;
  nextStart: number;
  first: boolean;
  plays: number;
  ending: boolean;
  timer?: ReturnType<typeof setInterval>;
}

export class BgmPlayer {
  private context?: AudioContext;
  private master?: GainNode;
  private voice?: Voice;
  private readonly buffers = new Map<BgmCue, Promise<Track | undefined>>();
  private readonly readyTracks = new Map<BgmCue, Track>();
  private readonly preloads = new Set<BgmCue>();
  private readonly voices = new Set<Voice>();
  private readonly retirements = new Set<Promise<void>>();
  private decodeQueue: Promise<unknown> = Promise.resolve();
  private retained?: Set<BgmCue>;
  private desired: BgmCue | null = null;
  private generation = 0;
  private unlocked = false;
  private duck = 1;
  private sceneGain = 1;
  volume: number;

  constructor(private readonly disabled: boolean, volumePercent: number, private readonly assets?: MediaAssets) {
    this.volume = volumePercent / 100;
  }

  get cue(): BgmCue | null { return this.desired; }
  get sceneVolumeMultiplier(): number { return this.sceneGain; }
  get effectiveVolume(): number { return this.volume * this.duck * this.sceneGain; }
  get available(): boolean { return !!this.context; }
  get enabled(): boolean { return !this.disabled; }
  ready(cue: BgmCue): boolean { return this.disabled || !this.context || !!this.readyTracks.get(cue) || !!this.assets?.isSkipped(`bgm:${cue}`); }

  retain(cues: readonly BgmCue[]): void { this.retained = new Set(cues); this.dropStale(); }

  async prepare(cue: BgmCue): Promise<void> {
    if (this.disabled || !this.context || this.assets?.isSkipped(`bgm:${cue}`)) return;
    if (this.readyTracks.has(cue)) return;
    const track = await this.load(cue);
    if (!track) throw new Error('Unable to decode music');
  }

  async prepareStage(cues: readonly BgmCue[]): Promise<void> {
    if (this.voice && !cues.includes(this.voice.cue)) this.fadeOut();
    await Promise.all(this.retirements);
    let failed = false;
    for (const cue of cues) { try { await this.prepare(cue); } catch { failed = true; } }
    if (failed) throw new Error('Unable to prepare stage music');
  }

  get diagnostics(): { tracks: number; bytes: number; decoding: number } {
    const buffers = this.liveBuffers();
    return { tracks: buffers.size, bytes: [...buffers].reduce((sum, b) => sum + b.length * b.numberOfChannels * 4, 0), decoding: this.buffers.size };
  }

  unlock(): void {
    if (this.disabled || this.unlocked) return;
    try {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume * this.duck;
      this.master.connect(this.context.destination);
      this.unlocked = true;
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
      if (this.desired && !this.assets) void this.switchTo(this.desired, ++this.generation);
      for (const cue of this.preloads) void this.load(cue);
      this.preloads.clear();
    } catch { /* AudioContextが使えない環境では無音にする */ }
  }

  preload(cue: BgmCue): void {
    if (this.disabled) return;
    if (this.assets) return; // 圧縮データの先読みはGameMediaが扱う。
    this.preloads.add(cue);
    if (this.unlocked) void this.load(cue);
  }

  sync(cue: BgmCue | null, duck: boolean, sceneGain = 1, transitionSeconds = 1): void {
    if (cue && this.assets?.isSkipped(`bgm:${cue}`)) cue = null;
    const targetDuck = duck ? 0.35 : 1;
    if (targetDuck !== this.duck) {
      this.duck = targetDuck;
      this.updateVolume();
    }
    const targetGain = Math.max(0, Math.min(1, sceneGain));
    const gainChanged = targetGain !== this.sceneGain;
    this.sceneGain = targetGain;
    if (cue === this.desired) {
      if (cue && this.unlocked && !this.disabled && !this.voice && this.readyTracks.has(cue)) void this.switchTo(cue, ++this.generation);
      if (gainChanged && this.context && this.voice) {
        const now = this.context.currentTime;
        const gain = this.voice.bus.gain;
        gain.cancelScheduledValues(now);
        if (transitionSeconds <= 0) gain.setValueAtTime(this.sceneGain, now);
        else {
          gain.setValueAtTime(gain.value, now);
          gain.linearRampToValueAtTime(this.sceneGain, now + transitionSeconds);
        }
      }
      return;
    }
    this.desired = cue;
    const generation = ++this.generation;
    if (cue && this.unlocked && !this.disabled) void this.switchTo(cue, generation);
    else this.fadeOut();
  }

  setVolume(percent: number): void {
    this.volume = Math.max(0, Math.min(100, percent)) / 100;
    this.updateVolume();
  }

  private updateVolume(): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const gain = this.master.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(this.volume * this.duck, now + 0.12);
  }

  private async switchTo(cue: BgmCue, generation: number): Promise<void> {
    const track = this.readyTracks.get(cue) ?? await this.load(cue);
    if (generation !== this.generation || !this.context || !this.master) return;
    this.fadeOut();
    if (!track) return;
    const bus = this.context.createGain();
    const now = this.context.currentTime;
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(this.sceneGain, now + 1);
    bus.connect(this.master);
    const voice: Voice = { cue, bus, track, sources: new Map(), nextStart: now + 0.02, first: true, plays: 0, ending: cue === 'ending' };
    this.voice = voice;
    this.voices.add(voice);
    this.schedule(voice);
    voice.timer = setInterval(() => this.schedule(voice), 500);
  }

  private load(cue: BgmCue): Promise<Track | undefined> {
    const ready = this.readyTracks.get(cue);
    if (ready) return Promise.resolve(ready);
    let pending = this.buffers.get(cue);
    if (!pending) {
      pending = (async () => {
        try {
          const data = this.assets ? await (await this.assets.load(`bgm:${cue}`)).arrayBuffer() : await this.fetchTrack(cue);
          if (!data || !this.context) return undefined;
          const decode = this.decodeQueue.then(async () => {
            await this.makeRoom(cue);
            if (this.retained && !this.retained.has(cue)) return undefined;
            const buffer = await this.context!.decodeAudioData(data);
            if (this.retained && !this.retained.has(cue)) return undefined;
            const track = { buffer, range: detectLoopRange(buffer) };
            this.readyTracks.set(cue, track);
            return track;
          });
          this.decodeQueue = decode.then(() => {}, () => {});
          return await decode;
        } catch { return undefined; }
      })();
      this.buffers.set(cue, pending);
      void pending.finally(() => { if (this.buffers.get(cue) === pending) this.buffers.delete(cue); });
    }
    return pending;
  }

  private async fetchTrack(cue: BgmCue): Promise<ArrayBuffer | undefined> {
    const response = await fetch(`${import.meta.env.BASE_URL}assets/bgm/${cue}.mp3`);
    return response.ok ? response.arrayBuffer() : undefined;
  }

  private liveBuffers(): Set<AudioBuffer> {
    return new Set([...this.readyTracks.values(), ...[...this.voices].map(voice => voice.track)].map(track => track.buffer));
  }

  private dropStale(): void {
    for (const cue of this.readyTracks.keys()) {
      if (this.retained && !this.retained.has(cue) && ![...this.voices].some(voice => voice.cue === cue)) this.readyTracks.delete(cue);
    }
  }

  private async makeRoom(cue: BgmCue): Promise<void> {
    this.dropStale();
    while (this.liveBuffers().size >= 2) {
      const unused = [...this.readyTracks.keys()].find(key => key !== cue && ![...this.voices].some(voice => voice.cue === key));
      if (unused) this.readyTracks.delete(unused);
      else if (this.retirements.size) await Promise.race(this.retirements);
      else throw new Error('Music buffers still in use');
    }
  }

  private schedule(voice: Voice): void {
    const context = this.context;
    if (!context || this.voice !== voice) return;
    const duration = voice.track.range.end - voice.track.range.start;
    if (duration <= 0) return;
    const overlap = Math.min(2, duration / 4);
    while (voice.nextStart < context.currentTime + 5) {
      const when = voice.nextStart;
      const source = context.createBufferSource();
      const envelope = context.createGain();
      source.buffer = voice.track.buffer;
      envelope.gain.setValueAtTime(voice.first ? 1 : 0, when);
      if (!voice.first) envelope.gain.linearRampToValueAtTime(1, when + overlap);
      envelope.gain.setValueAtTime(1, when + duration - overlap);
      envelope.gain.linearRampToValueAtTime(0, when + duration);
      source.connect(envelope).connect(voice.bus);
      source.start(when, voice.track.range.start, duration);
      source.onended = () => { voice.sources.delete(source); source.disconnect(); envelope.disconnect(); };
      voice.sources.set(source, envelope);
      voice.first = false;
      voice.plays++;
      // 通常のFinでは2周目の余韻を使い切る。描画が止まった場合は次の2周へつなぐ。
      voice.nextStart += duration - (voice.ending && voice.plays % ENDING_MUSIC_PLAYS === 0 ? 0 : overlap);
    }
  }

  private fadeOut(): void {
    const voice = this.voice;
    if (!voice || !this.context) return;
    this.voice = undefined;
    if (voice.timer) clearInterval(voice.timer);
    const now = this.context.currentTime;
    voice.bus.gain.cancelScheduledValues(now);
    voice.bus.gain.setValueAtTime(voice.bus.gain.value, now);
    voice.bus.gain.linearRampToValueAtTime(0, now + 1);
    const retiring = new Promise<void>(resolve => setTimeout(() => {
      for (const [source, envelope] of voice.sources) { try { source.stop(); } catch { /* 再生終了済み */ } source.onended = null; source.disconnect(); envelope.disconnect(); source.buffer = null; }
      voice.sources.clear(); voice.bus.disconnect(); this.voices.delete(voice); this.dropStale(); resolve();
    }, 1100));
    this.retirements.add(retiring);
    void retiring.then(() => this.retirements.delete(retiring));
  }
}
