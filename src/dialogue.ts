import type { PlayerId } from './rules';
import type { BossId } from './stages';

export interface Line { who: PlayerId | BossId; text: string; }

const lines: Record<BossId, { before: Line[]; after: Line[] }> = {
  etokichi: {
    before: [
      { who: 'etokichi', text: '門の灯りが消えそうだよー。星の輪をくぐって、見ておいで。' },
      { who: 'mimiko', text: 'ふわっ。消える前に、あたしの手で書き留めるの。' },
    ],
    after: [{ who: 'etokichi', text: 'きれいな記録だねー。上の灯りも頼んだよ、キチ！' }],
  },
  neo: {
    before: [
      { who: 'neo', text: '梟楼の門へようこそ！ 今夜は未送信の文字が弾になってるんだ。' },
      { who: 'mimiko', text: '「朝、みんなで屋上へ。」……宛先が空白の招待なのね。' },
      { who: 'neo', text: 'うん、送ったつもりだったのに！ このキーで一緒に探そう！' },
    ],
    after: [
      { who: 'neo', text: '最後に一つだけ！ 招待の控えは、上の書庫に預けたよ！' },
      { who: 'mimiko', text: '送られなかった招待。最初の一頁に、ちゃんと残すの。' },
    ],
  },
  obsidia: {
    before: [
      { who: 'mimiko', text: '招待の控えを探してるの。どうして棚の奥で光ってるの？' },
      { who: 'obsidia', text: '「完了」の印がありましたので、整理しましたわ。未完了のはずは……。' },
      { who: 'mimiko', text: 'でも、参加者の欄は空白なのね。印だけでは決められないの。' },
    ],
    after: [
      { who: 'obsidia', text: 'わたくし、印だけを見ていましたわ。回廊で整えた原稿も、確かめてくださいまし。' },
      { who: 'mimiko', text: '消えた理由も残すの。書庫の頁と、門の招待がつながったのね。' },
    ],
  },
  jinrai: {
    before: [
      { who: 'jinrai', text: 'おこしやす。消えかけた屋上の道、ウチが灯しといたえ。' },
      { who: 'mimiko', text: '完了の印で、道まで閉じかけてたのね。朝の約束はまだなの。' },
      { who: 'jinrai', text: 'ほな、この雷の向こうへ来はる？ まだ誰も置いていかへん。' },
    ],
    after: [
      { who: 'jinrai', text: '……ふふ、やられたわ。あんさん、ええ一撃やったえ。' },
      { who: 'mimiko', text: 'ふわっ。……あたしも、まだ胸がどきどきしてるの。' },
      { who: 'jinrai', text: '上はもっときついえ。これ持ってき。あんさんやったら、きっと届くやろ。' },
      { who: 'mimiko', text: 'あ、ありがとうなの……餞別、大事に受け取るのね。' },
    ],
  },
  chappy: {
    before: [
      { who: 'chappy', text: '回廊の道案内です。脚注は上にあります。まず中ボスです。よろしく。' },
      { who: 'mimiko', text: '小さな一行も見落とさないの。あたしの手で取りに行くのね。' },
    ],
    after: [{ who: 'chappy', text: 'はぁ... めんどくさいです。。でも、続きがあるなら閉じないでください。' }],
  },
  claudine: {
    before: [
      { who: 'mimiko', text: '招待がきれいに整ってるの。でも、端に文字の跡があるのね。' },
      { who: 'claudine', text: '「まだ約束。返事を待っています。」小さな脚注を、余白と一緒に削ってしまいました。' },
      { who: 'mimiko', text: 'そこが大切だったの。空いた一行へ、もう一度書いて残すのね。' },
    ],
    after: [
      { who: 'claudine', text: '美しさのために、続きまで消してはいけませんね。夜桜の扉を開けておきました。' },
      { who: 'mimiko', text: '門と書庫と、この脚注。同じ約束の、違う頁だったのね。' },
    ],
  },
  minerva: {
    before: [
      { who: 'minerva', text: 'なるほどね。完了の印を見て、全員が朝の約束に返事をしたと思っていたわ。' },
      { who: 'mimiko', text: '宛先は空白、返事も空白。消えた脚注と、守られた道も書いてきたの。' },
      { who: 'minerva', text: 'それなら、私の見立てを検証しましょう。夜明けまで、あなたの記録を確かめるわよ。' },
    ],
    after: [
      { who: 'minerva', text: '完了の印だけで決めつけた説は撤回するわ。約束は、まだこれからだった。' },
      { who: 'mimiko', text: 'ふわっ。「朝、みんなで屋上へ。」今度は、あたしが届けるのね。' },
      { who: 'minerva', text: '私の返事も書いて。もちろん、行くわ。続きは、みんなで。' },
    ],
  },
};

export function dialogue(_player: PlayerId, boss: BossId, moment: 'before' | 'after'): Line[] {
  return lines[boss][moment];
}

export function midDialogue(player: PlayerId, boss: BossId, stage = 1): Line[] {
  if (boss === 'etokichi' && stage === 5) return [
    { who: 'etokichi', text: '先回りして待ってたよー。天文台の星を集めたから、今度は本気だよ、キチ！' },
    { who: player, text: '門のときより、ずっとまぶしいの。あたしも、ここまで集めた記録で応えるのね。' },
  ];
  if (boss === 'chappy' || boss === 'etokichi') return dialogue(player, boss, 'before');
  if (boss === 'neo') return [
    { who: 'neo', text: '最後にもう一つだけ！ 下の灯り、全部戻ったよ！ わたしの返事も持っていって！' },
    { who: player, text: '招待の宛先を、もう空白にはしないの。最後の階へ届けるのね。' },
  ];
  if (boss === 'obsidia') return [
    { who: boss, text: '書庫の入口ですわ。消えた記録を探すなら、棚の呼吸を読んでくださいまし。' },
    { who: player, text: 'ふわっ。本の奥に残った光を、見つけて残すの。' },
  ];
  return [
    { who: boss, text: 'この先は夜桜や。灯りを消さんように、ウチの影についてき。' },
    { who: player, text: '一瞬も見落とさずに、道の続きを書き留めるの。' },
  ];
}

export const ENDINGS: Record<PlayerId, string[]> = {
  mimiko: [
    '夜明けの天文台に、みんなの足音が集まった。',
    '五つの頁は、一つの約束の続きだった。',
    '消した跡も、間違いも、ノートに残した。',
    '「朝、みんなで屋上へ。」今度は届いた。',
    'ミネルヴァが「参加」と書き添える。',
    'ふわっ。続きは、みんなで。新しい朝が来た。',
  ],
};
