const FORBIDDEN_LINE_START = '。、」』）！？…ー';

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
