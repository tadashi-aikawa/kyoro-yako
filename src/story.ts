export const GAME_TITLE = '梟楼夜航';
export const GAME_READING = 'きょうろうやこう';

export const RECORDS = [
  { title: '門：送られなかった招待', lines: ['「朝、みんなで屋上へ。」', '送信欄には、空白のままの宛先。', '約束は、まだ誰にも届いていなかった。'] },
  { title: '書庫：完了の印', lines: ['招待のページには「完了」の印。', 'でも、参加者の欄は空白だった。', '送ったつもりの約束が、棚の奥へ消えた。'] },
  { title: '回廊：削られた一行', lines: ['整えられた招待から、脚注が落ちていた。', '「まだ約束。返事を待っています。」', '余白に隠れた一行が、夜をつなぎ直す。'] },
  { title: '夜桜：帰り道の灯り', lines: ['消えかけた屋上への道を、迅雷が守った。', '「まだ誰も置いていかへん。」', '約束に必要なのは、閉じる印ではなかった。'] },
  { title: '天文台：続きは、みんなで', lines: ['完了の印を信じた見立ては、撤回された。', 'みみこのノートに、みんなの返事が並ぶ。', '「朝、みんなで屋上へ。」今度は届いた。'] },
] as const;

export function readRecords(value: string): number[] {
  return [...new Set(value.split(',').filter((part) => /^[1-5]$/.test(part)).map(Number))].sort((a, b) => a - b);
}
