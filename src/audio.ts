export type Sound = 'shot' | 'hit' | 'graze' | 'kill' | 'bomb' | 'declare' | 'capture' | 'item' | 'extend'
  | 'enemyShot' | 'jinraiShot' | 'laser' | 'thunder' | 'thunderBurst' | 'ninpo' | 'slash' | 'wind' | 'turn' | 'split' | 'sweepCharge' | 'sweepBurst' | 'prayerCharge';
// 周波数・秒数・波形・終端周波数・音量・最短間隔。
// 常時鳴る自機ショットを抑え、敵の発射と仕掛けの切り替わりを聞き取れる比率にする。
const tones: Record<Sound, [number, number, OscillatorType, number, number, number]> = {
  shot: [820, 0.035, 'triangle', 1107, 0.03, 0.07], hit: [95, 0.32, 'sawtooth', 40, 0.12, 0.025],
  graze: [1100, 0.045, 'sine', 1485, 0.12, 0.025], kill: [330, 0.12, 'triangle', 446, 0.12, 0.025],
  bomb: [125, 0.7, 'sawtooth', 40, 0.12, 0.025], declare: [220, 0.7, 'triangle', 880, 0.16, 0.3],
  capture: [880, 0.6, 'triangle', 1188, 0.12, 0.025], item: [950, 0.06, 'sine', 1283, 0.12, 0.025],
  extend: [660, 0.5, 'triangle', 891, 0.12, 0.025], enemyShot: [520, 0.08, 'triangle', 190, 0.2, 0.11],
  jinraiShot: [1700, 0.055, 'sawtooth', 130, 0.28, 0.055],
  laser: [180, 0.45, 'sawtooth', 960, 0.18, 0.3], thunder: [90, 0.5, 'sawtooth', 40, 0.24, 0.25],
  slash: [1500, 0.2, 'triangle', 120, 0.22, 0.18], wind: [280, 0.65, 'sine', 700, 0.2, 0.5],
  turn: [760, 0.18, 'sine', 240, 0.22, 0.16], split: [1200, 0.1, 'triangle', 540, 0.15, 0.12],
  ninpo: [1600, 0.18, 'triangle', 180, 0.2, 0.16], thunderBurst: [2100, 0.27, 'sawtooth', 65, 0.25, 0.25],
  sweepCharge: [160, 0.85, 'sine', 980, 0.18, 0.5], sweepBurst: [1800, 0.38, 'sawtooth', 70, 0.26, 0.16],
  prayerCharge: [96, 1.2, 'triangle', 150, 0.26, 0.9],
};

export class AudioBank {
  volume = 0.5;
  private context?: AudioContext;
  private last: Partial<Record<Sound, number>> = {};

  unlock(): void {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
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
      } else gain.gain.linearRampToValueAtTime(this.volume * peak, now + (sound === 'jinraiShot' ? 0.0015 : 0.005));
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(now);
      oscillator.stop(now + duration);
      if (sound === 'thunder' || sound === 'thunderBurst' || sound === 'ninpo' || sound === 'slash' || sound === 'wind' || sound === 'declare' || sound === 'sweepBurst' || sound === 'jinraiShot') this.noise(now, sound === 'thunderBurst' ? 0.55 : duration, sound);
    } catch { /* audio is optional when browser blocks it */ }
  }

  private noise(now: number, duration: number, sound: Sound): void {
    const context = this.context!;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource(); source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = sound === 'thunder' ? 'lowpass' : 'bandpass';
    filter.frequency.setValueAtTime(sound === 'thunderBurst' ? 3800 : sound === 'thunder' ? 900 : 2200, now);
    if (sound === 'thunderBurst') filter.Q.value = 0.55;
    filter.frequency.exponentialRampToValueAtTime(sound === 'wind' ? 3200 : 160, now + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(this.volume * (sound === 'declare' ? 0.14 : sound === 'thunderBurst' ? 0.3 : 0.22), now + (sound === 'wind' ? 0.15 : sound === 'jinraiShot' ? 0.002 : 0.008));
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter).connect(gain).connect(context.destination);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(now); source.stop(now + duration);
  }
}
