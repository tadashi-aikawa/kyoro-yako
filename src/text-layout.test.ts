import { describe, expect, it } from 'vitest';
import { wrapDialogue } from './text-layout';

describe('会話の禁則処理', () => {
  const measure = (text: string) => [...text].length * 10;

  it('句点を前の行へぶら下げる', () => {
    expect(wrapDialogue('まずは手合わせを。次へ', 90, measure)).toEqual(['まずは手合わせを。', '次へ']);
  });

  it('閉じ括弧や感嘆符を行頭にしない', () => {
    const lines = wrapDialogue('「よろしく。」！次へ', 70, measure);
    expect(lines.slice(1).every((line) => !'。、」』）！？…ー'.includes(line[0]))).toBe(true);
  });
});
