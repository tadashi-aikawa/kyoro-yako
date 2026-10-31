// 質問票の試聴用。採用するまでゲーム本編へは読み込まない。
export const WARP_OPTIONS = {
  a: { title: '太く鋭いシュイン', duration: 0.36 },
  b: { title: '短いシュピン', duration: 0.27 },
  c: { title: '二重に重なるシュイン', duration: 0.43 },
  old: { title: '前のフォン', duration: 0.5 },
};

export function warpSamples(id, rate = 48000) {
  const spec = WARP_OPTIONS[id];
  if (!spec) throw new Error('Unknown warp option');
  const data = new Float32Array(Math.ceil(rate * spec.duration));
  let seed = 90431, soft = 0, phase = 0, second = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / rate, duration = spec.duration;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    soft += (noise - soft) * 0.12;
    const air = noise - soft;
    if (id === 'old') {
      // 変更前のjinraiEnergyの式と同じ。再生時のローパスも元の値を使う。
      const attack = 0.08, fall = Math.log(280 / 85) / (duration - attack);
      const cycles = t < attack ? 180 * t + 625 * t * t : 180 * attack + 625 * attack * attack + 280 / fall * (1 - Math.exp(-fall * (t - attack)));
      const p = Math.PI * 2 * cycles;
      second += (noise - second) * 0.07;
      const tone = Math.sin(p) * 0.6 + Math.sin(p * 1.012) * 0.25 + Math.sin(p * 2) * 0.15;
      data[i] = (tone + second * 0.3) * Math.min(1, t / 0.06) * Math.exp(-t * 3) * Math.min(1, t / 0.04, (duration - t) / 0.12);
      continue;
    }
    const fade = Math.min(1, t / 0.002, (duration - t) / 0.035);
    if (id === 'a') {
      // 太い芯と位相変調。約25msで跳ね上がり、金属的な尾を残して落ちる。
      const frequency = 520 + 2850 * (1 - Math.exp(-t / 0.009)) * Math.exp(-t * 9);
      phase += Math.PI * 2 * frequency / rate;
      const fm = phase + Math.sin(phase * 1.41) * 1.35 * Math.exp(-t * 8);
      const body = Math.sin(fm) * 0.65 + Math.sin(phase * 0.502) * 0.28 + Math.sin(phase * 2.003 + 0.6) * 0.2;
      const rush = air * 0.85 * Math.exp(-t * 28);
      data[i] = Math.tanh((body * Math.exp(-t * 8.5) + rush) * 1.6) * fade * 0.72;
    } else if (id === 'b') {
      // 高い輪郭を先に出し、急降下する「シュピン」。長い低音は付けない。
      const frequency = 1100 + 5100 * Math.exp(-t * 22);
      phase += Math.PI * 2 * frequency / rate;
      const fm = phase + Math.sin(phase * 2.01) * 1.1 * Math.exp(-t * 16);
      const hit = Math.sin(fm) * 0.7 + Math.sin(phase * 0.751) * 0.25;
      data[i] = Math.tanh((hit + air * Math.exp(-t * 35) * 0.8) * 1.45) * Math.exp(-t * 13) * fade * 0.78;
    } else {
      // 50ms違いの2層。最初の空気音の後ろにもう一度高音が走る。
      const frequency = 450 + 3300 * Math.exp(-t * 10);
      phase += Math.PI * 2 * frequency / rate;
      const age = Math.max(0, t - 0.05);
      second += Math.PI * 2 * (680 + 4000 * Math.exp(-age * 15)) / rate;
      const first = Math.sin(phase + Math.sin(phase * 1.5) * 0.8) * Math.exp(-t * 9);
      const echo = t < 0.05 ? 0 : Math.sin(second + Math.sin(second * 1.99) * 0.9) * Math.min(1, age / 0.004) * Math.exp(-age * 10);
      const body = first * 0.65 + echo * 0.55 + air * Math.exp(-t * 22) * 0.7;
      data[i] = Math.tanh(body * 1.7) * fade * 0.72;
    }
  }
  return data;
}

export function warpFilter(id) {
  return id === 'old' ? { from: 1000, to: 450 } : { from: 12000, to: 3800 };
}
