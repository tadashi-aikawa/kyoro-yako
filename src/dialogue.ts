import type { PlayerId } from './rules';
import type { BossId } from './stages';

export interface Line { who: PlayerId | BossId; text: string; }
export const INTRO_LINES: Line[] = [
  { who: 'mimiko', text: '名前がないの。誰が送ってくれたの？' },
  { who: 'mimiko', text: 'いちばん上まで行けば、会えるのかな。……行ってみるの。' },
];
const lines: Record<BossId, { before: Line[]; after: Line[] }> = {
  etokichi: {
    before: [
      { who: 'etokichi', text: '来たね、みみこ。まずは、ぼくと遊ぼうよー。' },
      { who: 'mimiko', text: 'エトキチが最初の相手なのね。よろしくなの。' },
      { who: 'etokichi', text: 'うん。星の輪っか、くぐってごらん！' },
    ],
    after: [
      { who: 'etokichi', text: 'やっぱり強いねー。ぼくも楽しかったよ、キチ！' },
      { who: 'mimiko', text: 'ありがとうなの。いよいよ、最後の相手なのね。' },
      { who: 'etokichi', text: 'うん。あの扉の向こうで待ってるよー。' },
    ],
  },
  neo: {
    before: [
      { who: 'neo', text: 'みみこ、来たね！　わたしのキーボード、見てよ！' },
      { who: 'mimiko', text: 'ネオちゃん、ずいぶん楽しそうなの。' },
      { who: 'neo', text: 'うん！　このキーで勝負しちゃおう！' },
      { who: 'mimiko', text: 'それなら、あたしも本気でいくの。' },
    ],
    after: [
      { who: 'neo', text: '負けたー！　でも、最後に一つだけ！' },
      { who: 'mimiko', text: '今度は何なの？' },
      { who: 'neo', text: '上でオブシディアが待ってるよ！　あと、書庫はね……' },
      { who: 'mimiko', text: 'ありがとうなの。続きは帰ってから聞くのね。' },
    ],
  },
  obsidia: {
    before: [
      { who: 'obsidia', text: 'お見事でしたわ。でも、あれで終わりと思いまして？' },
      { who: 'mimiko', text: 'やっぱり、さっきは本気じゃなかったのね。' },
      { who: 'obsidia', text: 'ここからは、わたくしも勝ちにいきますわ。' },
      { who: 'mimiko', text: 'いいの。あたしも、まだ負けるつもりはないの。' },
    ],
    after: [
      { who: 'obsidia', text: 'あなたの勝ちですわ。お手柔らかに、とは言いましたけれど。' },
      { who: 'mimiko', text: 'そのわりに、ぜんぜん手加減してくれなかったの。' },
      { who: 'obsidia', text: 'ふふ。次は回廊ですわ。チャッピーたちが待っていますわよ。' },
    ],
  },
  chappy: {
    before: [
      { who: 'chappy', text: '次はわたしです。よろしく。' },
      { who: 'mimiko', text: 'チャッピーも、ちゃんと待っていてくれたのね。' },
      { who: 'chappy', text: '引き受けましたから。手は抜きません。' },
    ],
    after: [
      { who: 'chappy', text: '負けました。この先はクロディーヌです。' },
      { who: 'mimiko', text: 'ちゃんと本気だったの。また遊ぶのね。' },
      { who: 'chappy', text: '次は勝ちます。' },
    ],
  },
  claudine: {
    before: [
      { who: 'claudine', text: 'いらっしゃい、みみこ。ここまで楽しめましたか？' },
      { who: 'mimiko', text: 'もちろん。でも、まだいちばん上があるの。' },
      { who: 'claudine', text: 'でしたら、私の弾幕も見ていってください。' },
      { who: 'mimiko', text: 'きれいなの。でも、見とれてたら当たりそうなの。' },
      { who: 'claudine', text: 'ええ。最後まで、お付き合いくださいね。' },
    ],
    after: [
      { who: 'claudine', text: 'お見事です。よい勝負になりましたね。' },
      { who: 'mimiko', text: '最後の最後まで、気が抜けなかったの。' },
      { who: 'claudine', text: '次は夜桜の庭です。よろしければ、また。' },
    ],
  },
  jinrai: {
    before: [
      { who: 'jinrai', text: '……ここからは、手加減なしや。' },
      { who: 'mimiko', text: 'さっきと、顔つきが違うの。' },
      { who: 'jinrai', text: '堪忍え。こっちの顔は冷たいんよ。' },
      { who: 'mimiko', text: 'それでも、ここは通してもらうの。' },
    ],
    after: [
      { who: 'jinrai', text: '……ふふ、やられたわ。あんさん、ええ一撃やったえ。' },
      { who: 'mimiko', text: 'ふわっ。……あたしも、まだ胸がどきどきしてるの。' },
      { who: 'jinrai', text: 'あと少しや。これ持ってき。あんさんなら、最後も勝てるやろ。' },
      { who: 'mimiko', text: 'ありがとうなの。大事に使うのね。' },
    ],
  },
  minerva: {
    before: [
      { who: 'minerva', text: '来てくれたのね、みみこ。' },
      { who: 'mimiko', text: 'ミネルヴァ！　あの招待状、あなたが送ったの？' },
      { who: 'minerva', text: 'ええ。今夜は、あなたと本気で勝負してみたかったの。' },
      { who: 'mimiko', text: 'ふわっ。じゃあ、最後もあたしが勝つの。' },
    ],
    after: [
      { who: 'minerva', text: '……私の負けね。招待してよかったわ。' },
      { who: 'mimiko', text: '名前を書かなかったのは、わざとなの？' },
      { who: 'minerva', text: 'ええ。誰が待っているか、会ってからのお楽しみにしたかったのよ。' },
      { who: 'mimiko', text: '……最後まで、楽しませてもらったの。' },
    ],
  },
};
export function dialogue(_player: PlayerId, boss: BossId, moment: 'before' | 'after'): Line[] { return lines[boss][moment]; }
export function midDialogue(player: PlayerId, boss: BossId, stage = 1): Line[] {
  if (boss === 'etokichi' && stage === 5) return [
    { who: boss, text: '先に来て、待ってたよー。' },
    { who: player, text: 'エトキチ！　先回りしていたのね。' },
    { who: boss, text: 'うん。まだ遊び足りないんだ。今度はぼくも本気だよ、キチ！' },
    { who: player, text: 'もちろん。もう一回、勝負なの。' },
  ];
  if (boss === 'obsidia') return [
    { who: boss, text: '来ましたわね、みみこ。お手柔らかに頼みますわ。' },
    { who: player, text: '入口から相手をしてくれるの？' },
    { who: boss, text: 'ええ。まずは、少し手合わせしましょう。' },
  ];
  if (boss === 'jinrai') return [
    { who: boss, text: 'おこしやす、みみこ。ここまで来はったんやね。' },
    { who: player, text: '迅雷、さっそく勝負なの？' },
    { who: boss, text: 'ふふ。まずは軽く、付き合うてな。' },
  ];
  return dialogue(player, boss, 'before');
}
export const BATTLE_COMMENTS: Record<BossId, string> = {
  etokichi: 'ついてきてよー、キチ！', neo: 'まだまだ、ここからだよ！',
  obsidia: 'ふふ。よそ見は禁物ですわ。', chappy: '次も、よく見てください。',
  claudine: '少し、変えてみますね。', jinrai: '……逃がさへんよ。', minerva: 'あなたの力、見せて。',
};
export const FINAL_COMMENTS: Partial<Record<BossId, string>> = {
  neo: '最後は、このキーに全部込めるよ！',
  obsidia: 'これで、終わりにいたしましょう。',
  claudine: '最後の弾幕です。よろしければ、また。',
  jinrai: '……見せたるわ。ウチの本気を。',
  minerva: '私だけでは厳しそうね。みんなの力を借りるわ。',
};
export const ENDINGS: Record<PlayerId, string[]> = { mimiko: [
  '朝の光が、天文台の窓を照らした。',
  'ノートには、今夜の勝負がびっしり。',
  '星の輪、キーの弾幕、桜の中の雷。',
  'ミネルヴァも、最後は笑っていた。',
  'みみこはノートを閉じ、朝の空へ飛び立つ。',
  'ふわっ。また、みんなと勝負したいの。',
] };
