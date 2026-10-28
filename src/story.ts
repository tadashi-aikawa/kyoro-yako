export const GAME_TITLE = '梟楼夜航';
export const GAME_READING = 'きょうろうやこう';

export const INVITATION = ['みみこへ。', '弾幕祭りにご招待します。', '各階で待つ相手に勝って、', '最上階の天文台へ', 'お越しください。'] as const;

export const RECORDS = [
  { title: '最初の勝負', lines: ['星の輪をくぐって、キーの弾幕をよけて。', 'いつもの二人が、今夜は手ごわい相手なの。', '次は書庫。オブシディアが待っているのね。'] },
  { title: '丁寧な本気', lines: ['最初はほんの手合わせ。奥で本気の勝負。', 'オブシディア、落ち着いた顔で容赦がないの。', '次は回廊。まだまだ上があるのね。'] },
  { title: 'ふたりとの勝負', lines: ['チャッピーは、口数より弾幕のほうが多かったの。', 'クロディーヌの弾幕は、きれいだけど油断できないの。', 'ふたりと、また勝負してみたいの。'] },
  { title: '迅雷の笑顔', lines: ['迅雷の顔が変わって、空気まで変わったの。', '勝負のあとは、いつもの笑顔と餞別。', 'あと一階。呼んだ人に、もうすぐ会えるのね。'] },
  { title: '招待状の差出人', lines: ['招待状を送ったのは、ミネルヴァだった。', 'みんなの本気を越えて、いちばん上まで来たの。', 'この一晩を、忘れないように書いておくの。'] },
] as const;

export function readRecords(value: string): number[] {
  return [...new Set(value.split(',').filter((part) => /^[1-5]$/.test(part)).map(Number))].sort((a, b) => a - b);
}
