// 完成タイムラインを組んでから試写範囲を切り出す。部分書き出しも同じ音位置になる。
export function audioPlan(music, { duration, from = 0, to = duration, partial = false }) {
  const segments = music.segments ?? [{ from: music.offset ?? 0, to: (music.offset ?? 0) + duration }];
  if (!segments.length || segments.some(s => !Number.isFinite(s.from) || !Number.isFinite(s.to) || s.from < 0 || s.to <= s.from)) throw new Error('music.segmentsのfrom/toが不正です');
  const crossfade = music.crossfade ?? 0.2;
  if (!Number.isFinite(crossfade) || crossfade < 0 || segments.some(s => s.to - s.from <= crossfade)) throw new Error('music.crossfadeが区間より長いか不正です');
  // 原曲のfromの音をpvStartに置く。重なりは前区間のtoより後ろから追加取得する。
  let pvStart = 0;
  const sourceRanges = segments.map((s, i) => {
    const range = { from: s.from, to: s.to + (i < segments.length - 1 ? crossfade : 0), pvStart };
    pvStart += s.to - s.from;
    return range;
  });
  const sampleRate = 44100;
  const spliceFadeIn = music.spliceFadeIn ?? 0.001;
  if (!Number.isFinite(spliceFadeIn) || spliceFadeIn < 0 || spliceFadeIn > 0.005) throw new Error('music.spliceFadeInは0〜0.005秒で指定してください');
  // 5msを超えないよう切り捨てる。標準1msは44サンプルになる。
  const spliceFadeInSamples = Math.floor(spliceFadeIn * sampleRate);
  const filters = sourceRanges.map((s, i) => {
    const chain = [`aresample=${sampleRate}`, 'aformat=sample_fmts=fltp', `atrim=start=${s.from}:end=${s.to}`, 'asetpts=PTS-STARTPTS'];
    if (crossfade > 0) {
      if (i > 0 && spliceFadeInSamples > 0) chain.push(`afade=t=in:ss=0:ns=${spliceFadeInSamples}:curve=tri`);
      if (i < segments.length - 1) chain.push(`afade=t=out:st=${segments[i].to - segments[i].from}:d=${crossfade}:curve=exp`);
      chain.push(`adelay=${Math.round(s.pvStart * sampleRate)}S:all=1`);
    }
    return `[1:a]${chain.join(',')}[s${i}]`;
  });
  let label = 's0';
  if (segments.length > 1) {
    label = 'joined';
    const inputs = segments.map((_, i) => `[s${i}]`).join('');
    filters.push(`${inputs}${crossfade ? `amix=inputs=${segments.length}:duration=longest:normalize=0:dropout_transition=0` : `concat=n=${segments.length}:v=0:a=1`}[${label}]`);
  }
  const joins = sourceRanges.slice(1).map(s => ({ start: s.pvStart, end: s.pvStart + crossfade, source: s.from }));
  const elapsed = pvStart;
  const finish = [`volume=${music.volume ?? 1}`, 'apad', `atrim=start=${from}:end=${to}`, 'asetpts=PTS-STARTPTS'];
  if (!partial && music.fadeOut > 0) finish.push(`afade=t=out:st=${Math.max(0, to - from - music.fadeOut)}:d=${music.fadeOut}`);
  filters.push(`[${label}]${finish.join(',')}[music]`);
  return { filter: filters.join(';'), segments, sourceRanges, crossfade, joins, mixMode: 'exponential-outgoing-short-incoming', sampleRate,
    spliceFadeInSamples, spliceFadeInSeconds: spliceFadeInSamples / sampleRate,
    contentDuration: elapsed, outputDuration: to - from, tailPadding: Math.max(0, duration - elapsed), fadeOut: partial ? 0 : music.fadeOut };
}

export function validateAudioSource(plan, sourceDuration) {
  if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) throw new Error('音源の長さを取得できません');
  for (const range of plan.sourceRanges) {
    if (range.to > sourceDuration + 1 / plan.sampleRate) throw new Error(`音源の長さ${sourceDuration}秒を取得範囲${range.from}〜${range.to}秒が超えています`);
  }
}

export function audioAlignmentWarnings(plan, cuts) {
  return plan.segments.flatMap((segment, i) => {
    if (!segment.cut) return [];
    const cut = cuts.find(c => c.id === segment.cut);
    const pvStart = plan.sourceRanges[i].pvStart;
    if (!cut) return [`音楽区間${i + 1}に対応するカット${segment.cut}がありません`];
    return Math.abs(cut.start - pvStart) > 1 / plan.sampleRate
      ? [`音楽区間${i + 1}のpvStart=${pvStart}秒と${cut.id}のstart=${cut.start}秒が一致しません`] : [];
  });
}
