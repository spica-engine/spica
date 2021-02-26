export function getLineNumberAndColumnFromRange(content: string, end: number) {
  let lineNumber = 1;
  let lastNewLinePos = 0;
  for (let pos = 0; pos < end; pos++) {
    const char = content.charAt(pos);
    if (/\r\n|\r|\n/.test(char)) {
      lineNumber++;
      lastNewLinePos = pos;
    }
  }
  return [lineNumber, end - lastNewLinePos];
}
