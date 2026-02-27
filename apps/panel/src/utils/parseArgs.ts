export function parseArgs(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar: string | null = null;

  for (const ch of input) {
    if (inQuote) {
      if (ch === quoteChar) {
        current += '"';
        inQuote = false;
        quoteChar = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      current += '"';
      inQuote = true;
      quoteChar = ch;
    } else if (ch === " " || ch === "\t") {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current) tokens.push(current);
  return tokens;
}
