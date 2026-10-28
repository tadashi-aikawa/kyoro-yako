const FORBIDDEN_LINE_START = '。、」』）！？…ーぁぃぅぇぉっゃゅょァィゥェォッャュョ';

export function wrapDialogue(value: string, width: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const character of value) {
    if (current && measure(current + character) > width && !FORBIDDEN_LINE_START.includes(character)) {
      lines.push(current);
      current = '';
    }
    current += character;
  }
  if (current) lines.push(current);
  return lines;
}

export function wrapBattleComment(value: string, width: number, measure: (text: string) => number): string[] {
  const lines = wrapDialogue(value, width, measure);
  if (lines.length <= 1) return lines;
  const breaks = [...value.matchAll(/[、。！？]/g)].map(match => match.index! + 1);
  const split = breaks.filter(index => index < value.length && measure(value.slice(0, index)) <= width && measure(value.slice(index)) <= width)
    .sort((a, b) => Math.abs(a * 2 - value.length) - Math.abs(b * 2 - value.length))[0];
  return split === undefined ? lines : [value.slice(0, split), value.slice(split)];
}
