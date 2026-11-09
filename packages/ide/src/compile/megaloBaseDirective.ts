export interface BaseDirectiveLocation {
  column: number;
  endColumn: number;
  length: number;
  line: number;
  offset: number;
  path: string;
}

/** Line/column (1-based) for a localOffset; skips CR like the megalo lexer. */
function positionAtOffset(
  source: string,
  offset: number
): { line: number; column: number } {
  let line = 1;
  let column = 1;
  const end = Math.min(Math.max(0, offset), source.length);
  for (let i = 0; i < end; i++) {
    const code = source.charCodeAt(i);
    if (code === 10 /* \n */) {
      line++;
      column = 1;
    } else if (code !== 13 /* \r */) {
      column++;
    }
  }
  return { line, column };
}

/** Locate `base "…"`, spanning from `base` through the closing quote. */
export function parseBaseDirective(
  source: string
): BaseDirectiveLocation | null {
  const match = /^\s*base\s+"([^"]+)"/m.exec(source);
  if (!match?.[1] || match.index === undefined) {
    return null;
  }
  const keywordOffset = match[0].search(/base\s+"/);
  if (keywordOffset < 0) {
    return null;
  }
  const offset = match.index + keywordOffset;
  const length = match[0].length - keywordOffset;
  const { line, column } = positionAtOffset(source, offset);
  return {
    path: match[1],
    line,
    column,
    endColumn: column + length,
    offset,
    length,
  };
}
