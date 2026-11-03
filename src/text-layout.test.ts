import { describe, expect, it } from 'vitest';
import { BATTLE_COMMENTS, FINAL_COMMENTS } from './dialogue';
import { AWAKENING_LINE } from './patterns/minerva-awakening';
import { wrapBattleComment, wrapDialogue } from './text-layout';

describe('会話の禁則処理', () => {
  const measure = (text: string) => [...text].length * 10;

  it('句点を前の行へぶら下げる', () => {
    expect(wrapDialogue('まずは手合わせを。次へ', 90, measure)).toEqual(['まずは手合わせを。', '次へ']);
  });

  it('閉じ括弧や感嘆符を行頭にしない', () => {
    const lines = wrapDialogue('「よろしく。」！次へ', 70, measure);
    expect(lines.slice(1).every((line) => !'。、」』）！？…ー'.includes(line[0]))).toBe(true);
  });

  it('小さい仮名を行頭へ分けない', () => {
    const lines = wrapDialogue('終わりにいたしましょう。', 100, measure);
    expect(lines.slice(1).every(line => !'ぁぃぅぇぉっゃゅょァィゥェォッャュョ'.includes(line[0]))).toBe(true);
    expect(lines.join('')).toBe('終わりにいたしましょう。');
  });
});

it('吹き出しの全コメントを欠落なく2行以内へ収める', () => {
  const measure = (text: string) => text.length * 12;
  for (const text of [...Object.values(BATTLE_COMMENTS), ...Object.values(FINAL_COMMENTS), AWAKENING_LINE]) {
    const width = text.includes('\n') ? 192 : 156;
    const lines = wrapBattleComment(text, width, measure);
    expect(lines.join('')).toBe(text.replaceAll('\n', '')); expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines.every(line => measure(line) <= width)).toBe(true);
  }
  expect(wrapBattleComment(FINAL_COMMENTS.minerva!, 192, measure)).toEqual(['ここまで追い詰められるなんて……', '次が本当に最後の技よ。']);
  expect(wrapBattleComment(FINAL_COMMENTS.claudine!, 192, measure)).toEqual(['素敵なひとときでしたね。', '最後は、想い出に残る一幕を。']);
});
