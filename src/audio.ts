export type Sound = 'shot' | 'hit' | 'graze' | 'kill' | 'bomb' | 'declare' | 'ultimateStamp' | 'ultimateShine' | 'capture' | 'item' | 'extend'
  | 'enemyShot' | 'jinraiShot' | 'jinraiCharge' | 'jinraiCrackle' | 'jinraiWarp' | 'laser' | 'thunder' | 'thunderBurst' | 'ninpo' | 'slash' | 'wind' | 'turn' | 'split' | 'sweepCharge' | 'sweepBurst' | 'prayerCharge' | 'owlRelease' | 'roseCharge' | 'roseBloom' | 'chappySnap' | 'caromTap' | 'fireworkRise' | 'fireworkGrandRise' | 'fireworkBoom';
export const ULTIMATE_SHINE_DURATION = 1.05;
// 周波数・秒数・波形・終端周波数・音量・最短間隔。
// 常時鳴る自機ショットを抑え、敵の発射と仕掛けの切り替わりを聞き取れる比率にする。
const tones: Record<Sound, [number, number, OscillatorType, number, number, number]> = {
  shot: [820, 0.035, 'triangle', 1107, 0.03, 0.07], hit: [95, 0.32, 'sawtooth', 40, 0.12, 0.025],
  ultimateStamp: [150, 0.28, 'triangle', 52, 0.85, 0.12], // 周波数・波形は専用バッファで合成し、ここでは秒数・音量・最短間隔だけ使う。
  ultimateShine: [1046.5, ULTIMATE_SHINE_DURATION, 'sine', 1046.5, 0.7, 0.3], // 風切り・衝撃・広がる残響を専用ステレオバッファで重ねる。
  graze: [1100, 0.045, 'sine', 1485, 0.12, 0.025], kill: [330, 0.12, 'triangle', 446, 0.12, 0.025],
  bomb: [125, 0.7, 'sawtooth', 40, 0.12, 0.025], declare: [220, 0.7, 'triangle', 880, 0.16, 0.3],
  capture: [880, 0.6, 'triangle', 1188, 0.12, 0.025], item: [950, 0.06, 'sine', 1283, 0.12, 0.025],
  extend: [660, 0.5, 'triangle', 891, 0.12, 0.025], enemyShot: [520, 0.08, 'triangle', 190, 0.2, 0.11],
  jinraiShot: [1700, 0.055, 'sawtooth', 130, 0.28, 0.055],
  jinraiCharge: [65, 5.5, 'sine', 145, 0.38, 5.3],
  jinraiCrackle: [120, 1.8, 'sawtooth', 120, 0.48, 1.5],
  jinraiWarp: [180, 0.55, 'sine', 85, 0.42, 0.35],
  laser: [180, 0.45, 'sawtooth', 960, 0.18, 0.3], thunder: [90, 0.5, 'sawtooth', 40, 0.24, 0.25],
  slash: [1500, 0.2, 'triangle', 120, 0.22, 0.18], wind: [280, 0.65, 'sine', 700, 0.2, 0.5],
  turn: [760, 0.18, 'sine', 240, 0.22, 0.16], split: [1200, 0.1, 'triangle', 540, 0.15, 0.12],
  ninpo: [1600, 0.18, 'triangle', 180, 0.2, 0.16], thunderBurst: [2100, 0.27, 'sawtooth', 65, 0.25, 0.25],
  sweepCharge: [160, 0.85, 'sine', 980, 0.18, 0.5], sweepBurst: [1800, 0.38, 'sawtooth', 70, 0.26, 0.16],
  prayerCharge: [96, 1.2, 'triangle', 150, 0.26, 0.9],
  owlRelease: [523.25, 3.2, 'sine', 523.25, 0.23, 1],
  roseCharge: [196, 0.95, 'sine', 1568, 0.24, 0.9],
  roseBloom: [1047, 0.28, 'triangle', 262, 0.21, 0.2],
  chappySnap: [2100, 0.055, 'triangle', 180, 0.3, 0.2],
  caromTap: [1550, 0.045, 'triangle', 1150, 0.16, 0.085],
  fireworkRise: [520, 0.86, 'sine', 2450, 0.18, 1],
  fireworkGrandRise: [330, 1.52, 'sine', 3000, 0.23, 2],
  fireworkBoom: [75, 1.2, 'sine', 32, 0.32, 2],
};

export class AudioBank {
  volume = 0.5;
  private context?: AudioContext;
  private last: Partial<Record<Sound, number>> = {};
  private readonly energySources = new Set<AudioBufferSourceNode>();
  private readonly fireworkSources = new Set<AudioScheduledSourceNode>();
  private stampBuffer?: AudioBuffer;
  private shineBuffer?: AudioBuffer;
  private ultimateRequested = false;

  prepareUltimate(): void {
    this.ultimateRequested = true;
    if (!this.context) return;
    try { this.prepareShineBuffer(); } catch { /* 音声を使えなくてもステージを開始する */ }
  }

  stopFireworks(): void {
    for (const source of this.fireworkSources) source.stop();
    this.fireworkSources.clear();
    delete this.last.fireworkRise; delete this.last.fireworkGrandRise; delete this.last.fireworkBoom;
  }

  stopEnergy(): void {
    this.stopFireworks();
    for (const source of this.energySources) source.stop();
    this.energySources.clear();
    delete this.last.jinraiCharge; delete this.last.jinraiCrackle; delete this.last.jinraiWarp;
    delete this.last.owlRelease;
    delete this.last.ultimateStamp;
    delete this.last.ultimateShine;
  }

  unlock(): void {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
      if (this.ultimateRequested) this.prepareShineBuffer();
    } catch { /* 音声を使えない環境でもゲームを続ける */ }
  }

  play(sound: Sound): void {
    if (this.volume <= 0) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state !== 'running') return;
      const now = this.context.currentTime;
      const [frequency, duration, wave, end, peak, interval] = tones[sound];
      if (now - (this.last[sound] ?? -Infinity) < interval) return;
      this.last[sound] = now;
      if (sound === 'ultimateStamp') { this.ultimateStamp(now, duration, peak); return; }
      if (sound === 'ultimateShine') { this.ultimateShine(now, duration, peak); return; }
      if (sound === 'owlRelease') { this.owlRelease(now, frequency, duration, peak); return; }
      if (sound === 'jinraiCharge' || sound === 'jinraiCrackle' || sound === 'jinraiWarp') {
        this.jinraiEnergy(now, sound, duration, peak); return;
      }
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
      gain.gain.setValueAtTime(0.001, now);
      if (sound === 'prayerCharge') {
        // 充填中に膨らむ低い唸り。近い周波数を重ね、音程の高い宣言音と区別する。
        gain.gain.linearRampToValueAtTime(this.volume * peak * 0.45, now + 0.12);
        gain.gain.linearRampToValueAtTime(this.volume * peak, now + duration - 0.12);
        const overtone = this.context.createOscillator();
        const mix = this.context.createGain(); mix.gain.value = 0.35;
        overtone.type = 'sine';
        overtone.frequency.setValueAtTime(frequency * 1.025, now);
        overtone.frequency.exponentialRampToValueAtTime(end * 1.025, now + duration);
        overtone.connect(mix).connect(gain);
        overtone.onended = () => { overtone.disconnect(); mix.disconnect(); };
        overtone.start(now); overtone.stop(now + duration);
      } else if (sound === 'fireworkRise' || sound === 'fireworkGrandRise') {
        // 息を含んだ「ヒュー」。大玉は長く低いところから高く打ち上げる。
        gain.gain.linearRampToValueAtTime(this.volume * peak, now + 0.12);
        gain.gain.linearRampToValueAtTime(this.volume * peak * 0.6, now + duration * 0.72);
      } else gain.gain.linearRampToValueAtTime(this.volume * peak, now + (sound === 'jinraiShot' ? 0.0015 : 0.005));
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      oscillator.connect(gain).connect(this.context.destination);
      const firework = sound === 'fireworkRise' || sound === 'fireworkGrandRise' || sound === 'fireworkBoom';
      oscillator.onended = () => { this.fireworkSources.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(now);
      oscillator.stop(now + duration);
      if (firework) this.fireworkSources.add(oscillator);
      if (sound === 'fireworkRise' || sound === 'fireworkGrandRise' || sound === 'fireworkBoom') this.noise(now, duration, sound);
      if (sound === 'thunder' || sound === 'thunderBurst' || sound === 'ninpo' || sound === 'slash' || sound === 'wind' || sound === 'declare' || sound === 'sweepBurst' || sound === 'jinraiShot') this.noise(now, sound === 'thunderBurst' ? 0.55 : duration, sound);
    } catch { /* audio is optional when browser blocks it */ }
  }

  private ultimateStamp(now: number, duration: number, peak: number): void {
    const context = this.context!;
    if (!this.stampBuffer) {
      this.stampBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
      const samples = this.stampBuffer.getChannelData(0);
      let lowNoise = 0;
      // 低い唸りではなく、硬いアタック・太鼓の胴鳴り・短い残響を重ねた「バン」。
      for (let i = 0; i < samples.length; i++) {
        const t = i / context.sampleRate;
        const noise = Math.random() * 2 - 1;
        lowNoise += (noise - lowNoise) * 0.38;
        const drumPhase = Math.PI * 2 * (70 * t + 100 * 0.016 * (1 - Math.exp(-t / 0.016)));
        const drum = Math.sin(drumPhase) * Math.exp(-t * 19) * 0.55;
        const body = Math.sin(Math.PI * 2 * 220 * t) * Math.exp(-t * 25) * 0.55;
        const crack = (noise - lowNoise) * Math.exp(-t * 65) * 0.9;
        const tail = lowNoise * Math.exp(-t * 13) * 0.5;
        samples[i] = Math.tanh((drum + body + crack + tail) * 1.6) * 0.82 * Math.min(1, t / 0.0015, (duration - t) / 0.035);
      }
    }
    const source = context.createBufferSource(); source.buffer = this.stampBuffer;
    const gain = context.createGain(); gain.gain.value = this.volume * peak;
    source.connect(gain).connect(context.destination);
    this.energySources.add(source);
    source.onended = () => { this.energySources.delete(source); source.disconnect(); gain.disconnect(); };
    source.start(now); source.stop(now + duration);
  }

  private prepareShineBuffer(): AudioBuffer {
    const context = this.context!;
    const duration = ULTIMATE_SHINE_DURATION;
    if (!this.shineBuffer) {
      const length = Math.ceil(context.sampleRate * duration), dry = new Float32Array(length);
      let band = 0, low = 0, softNoise = 0;
      for (let i = 0; i < length; i++) {
        const t = i / context.sampleRate;
        const noise = Math.random() * 2 - 1;
        softNoise += (noise - softNoise) * 0.22;
        // 暗い風が70msで高域へ抜け、その先に広い空気の尾を残す。
        const sweep = Math.min(1, t / 0.07);
        const frequency = 420 * (7800 / 420) ** sweep * Math.exp(-Math.max(0, t - 0.07) * 1.5);
        const g = Math.tan(Math.PI * frequency / context.sampleRate), damping = 0.65;
        const high = (noise - (2 * damping + g) * band - low) / (1 + 2 * damping * g + g * g);
        const filtered = g * high + band;
        const filteredLow = g * filtered + low;
        band = g * high + filtered; low = g * filtered + filteredLow;
        const rush = filtered * Math.min(1, t / 0.045) * Math.exp(-Math.max(0, t - 0.065) * 10) * 2.1;
        const age = Math.max(0, t - 0.065);
        const hit = (softNoise * 1.25 + Math.sin(Math.PI * 2 * (95 * age + 95 * 0.012 * (1 - Math.exp(-age / 0.012)))) * 0.45) * Math.min(1, age / 0.002) * Math.exp(-age * 32);
        const phase = Math.PI * 2 * (1046.5 * age - 180 * 0.02 * (1 - Math.exp(-age / 0.02)));
        const shimmer = (Math.sin(phase) + Math.sin(phase * 1.5 + 0.25 * Math.sin(age * 19)) * 0.55 + Math.sin(phase * 2.003) * 0.3) * Math.min(1, age / 0.008) * Math.exp(-age * 8) * 0.14;
        const air = (noise - softNoise) * Math.min(1, age / 0.015) * Math.exp(-age * 6) * 0.32;
        dry[i] = Math.tanh((rush + hit + shimmer + air) * 1.4);
      }
      this.shineBuffer = context.createBuffer(2, length, context.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const samples = this.shineBuffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          const t = i / context.sampleRate;
          const pan = Math.max(-1, Math.min(1, (t / 0.13) * 2 - 1));
          let value = dry[i] * (0.8 + (channel === 0 ? -pan : pan) * 0.15);
          // 異なる反射を左右へ散らし、単音の「チン」ではなく奥行きのある決め音にする。
          for (let tap = 1; tap <= 9; tap++) {
            const delay = Math.round((0.029 * tap + 0.006 * tap * tap + channel * 0.011) * context.sampleRate);
            if (i >= delay) value += dry[i - delay] * Math.exp(-tap * 0.32) * 0.2 * (tap % 2 ? 1 : -1);
          }
          samples[i] = Math.tanh(value * 1.2) * 0.72 * Math.min(1, t / 0.003, (duration - t) / 0.12);
        }
      }
    }
    return this.shineBuffer;
  }

  private ultimateShine(now: number, duration: number, peak: number): void {
    const context = this.context!;
    const source = context.createBufferSource(); source.buffer = this.prepareShineBuffer();
    const gain = context.createGain(); gain.gain.value = this.volume * peak;
    source.connect(gain).connect(context.destination);
    this.energySources.add(source);
    source.onended = () => { this.energySources.delete(source); source.disconnect(); gain.disconnect(); };
    source.start(now); source.stop(now + duration);
  }

  private owlRelease(now: number, frequency: number, duration: number, peak: number): void {
    const context = this.context!;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    // 澄んだ鐘を長三和音で重ね、わずかな倍音の揺れと長い余韻で離陸を包む。
    const notes = [1, 1.25, 1.5, 2];
    for (let i = 0; i < samples.length; i++) {
      const t = i / context.sampleRate;
      let value = 0;
      for (const [index, ratio] of notes.entries()) {
        const age = t - index * 0.16;
        if (age < 0) continue;
        const phase = Math.PI * 2 * frequency * ratio * age;
        const tone = Math.sin(phase) + Math.sin(phase * 1.003) * 0.25 + Math.sin(phase * 2.76) * Math.exp(-age * 3) * 0.15;
        value += tone * Math.min(1, age / 0.025) * Math.exp(-age * 1.45) * (index === 3 ? 0.22 : 0.3);
      }
      samples[i] = value * Math.min(1, (duration - t) / 0.3);
    }
    const source = context.createBufferSource(); source.buffer = buffer;
    const gain = context.createGain(); gain.gain.value = this.volume * peak;
    source.connect(gain).connect(context.destination);
    this.energySources.add(source);
    source.onended = () => { this.energySources.delete(source); source.disconnect(); gain.disconnect(); };
    source.start(now); source.stop(now + duration);
  }

  private jinraiEnergy(now: number, sound: 'jinraiCharge' | 'jinraiCrackle' | 'jinraiWarp', duration: number, peak: number): void {
    const context = this.context!;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    let rumble = 0;
    for (let i = 0; i < samples.length; i++) {
      const t = i / context.sampleRate;
      const p = t / duration;
      const noise = Math.random() * 2 - 1;
      const fade = Math.min(1, t / 0.04, (duration - t) / 0.12);
      if (sound === 'jinraiCharge') {
        // 充填が進むほど太くなる「ブオー」。低い唸りに空気の揺れを重ねる。
        rumble += (noise - rumble) * 0.055;
        const phase = Math.PI * 2 * (65 * t + 40 / duration * t * t);
        const tone = Math.sin(phase) * 0.4 + Math.sin(phase * 1.018) * 0.2 + Math.sin(phase * 3) * 0.28 + Math.sin(phase * 4) * 0.12;
        samples[i] = (tone + rumble * 0.8) * (0.45 + p * 0.55) * fade;
      } else if (sound === 'jinraiCrackle') {
        // 一撃で減衰させず、細かな放電の断続と電源ハムを重ねて鳴らし続ける。
        const crackle = 0.06 + 0.94 * Math.max(0, Math.sin(t * Math.PI * 2 * 26 + Math.sin(t * 37))) ** 2;
        const buzz = Math.sin(t * Math.PI * 2 * 120) + Math.sin(t * Math.PI * 2 * 240) * 0.5 + Math.sin(t * Math.PI * 2 * 480) * 0.25;
        samples[i] = (noise * 0.5 + buzz * 0.35) * crackle * fade;
      } else {
        // 低い音程が膨らんで落ちる「フオン」。風切り音より忍術の移動に寄せる。
        rumble += (noise - rumble) * 0.07;
        const attack = 0.08, fall = Math.log(280 / 85) / (duration - attack);
        const cycles = t < attack ? 180 * t + 625 * t * t : 180 * attack + 625 * attack * attack + 280 / fall * (1 - Math.exp(-fall * (t - attack)));
        const phase = Math.PI * 2 * cycles;
        const tone = Math.sin(phase) * 0.6 + Math.sin(phase * 1.012) * 0.25 + Math.sin(phase * 2) * 0.15;
        samples[i] = (tone + rumble * 0.3) * Math.min(1, t / 0.06) * Math.exp(-t * 3) * fade;
      }
    }
    const source = context.createBufferSource(); source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(sound === 'jinraiCharge' ? 600 : sound === 'jinraiWarp' ? 1000 : 3600, now);
    filter.frequency.exponentialRampToValueAtTime(sound === 'jinraiCharge' ? 1400 : sound === 'jinraiWarp' ? 450 : 5200, now + duration);
    const gain = context.createGain(); gain.gain.value = this.volume * peak;
    source.connect(filter).connect(gain).connect(context.destination);
    this.energySources.add(source);
    source.onended = () => { this.energySources.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(now); source.stop(now + duration);
  }

  private noise(now: number, duration: number, sound: Sound): void {
    const context = this.context!;
    const rising = sound === 'fireworkRise' || sound === 'fireworkGrandRise';
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource(); source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = sound === 'thunder' || sound === 'fireworkBoom' ? 'lowpass' : 'bandpass';
    filter.frequency.setValueAtTime(rising ? 700 : sound === 'fireworkBoom' ? 1200 : sound === 'thunderBurst' ? 3800 : sound === 'thunder' ? 900 : 2200, now);
    if (rising) filter.Q.value = 5;
    if (sound === 'thunderBurst') filter.Q.value = 0.55;
    filter.frequency.exponentialRampToValueAtTime(rising ? 2800 : sound === 'fireworkBoom' ? 70 : sound === 'wind' ? 3200 : 160, now + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(this.volume * (rising ? 0.12 : sound === 'fireworkBoom' ? 0.28 : sound === 'declare' ? 0.14 : sound === 'thunderBurst' ? 0.3 : 0.22), now + (sound === 'wind' || rising ? 0.15 : sound === 'jinraiShot' ? 0.002 : 0.008));
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter).connect(gain).connect(context.destination);
    source.onended = () => { this.fireworkSources.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(now); source.stop(now + duration);
    if (rising || sound === 'fireworkBoom') this.fireworkSources.add(source);
  }
}
