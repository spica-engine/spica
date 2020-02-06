import {ObjectId} from "@spica-server/database";

export function levenshtein(
  a: Set<string> | Array<string>,
  b: Set<string> | Array<string>
): {distance: number; sequence: Sequence[]} {
  a = Array.from(a);
  b = Array.from(b);

  const m = new Array(a.length + 1);

  for (let i = 0; i < m.length; i++) {
    m[i] = new Array(b.length + 1);

    for (let j = 0; j < m[i].length; j++) {
      if (i === 0) m[i][j] = j;
      if (j === 0) m[i][j] = i;
    }
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        m[i][j] = m[i - 1][j - 1];
      } else {
        m[i][j] = Math.min(m[i - 1][j], m[i][j - 1], m[i - 1][j - 1]) + 1;
      }
    }
  }

  let i = a.length,
    j = b.length;

  const sequence = new Array<Sequence>();

  while (i !== 0 && j !== 0) {
    if (a[i - 1] === b[j - 1]) {
      // NO-OP
      i--;
      j--;
    } else if (m[i - 1][j] < m[i][j - 1]) {
      sequence.push({kind: SequenceKind.Delete, item: a[i - 1], at: i - 1});
      i--;
    } else if (m[i - 1][j] === m[i][j - 1]) {
      sequence.push({kind: SequenceKind.Substitute, item: a[i - 1], with: b[j - 1], at: i - 1});
      i--;
      j--;
    } else {
      sequence.push({kind: SequenceKind.Insert, item: b[j - 1], at: j - 1});
      j--;
    }
  }

  if (i === 0 && j > 0) {
    for (let n = j - 1; n >= 0; n--) {
      sequence.push({kind: SequenceKind.Insert, item: b[n], at: n});
    }
  } else if (j === 0 && i > 0) {
    for (let m = i - 1; m >= 0; m--) {
      sequence.push({kind: SequenceKind.Delete, item: a[m], at: m});
    }
  }
  return {distance: m[a.length][b.length], sequence};
}

export interface Sequence {
  kind: SequenceKind;
  item: string | ObjectId;
  at: number;
  with?: string | ObjectId;
}

export enum SequenceKind {
  Delete = 0,
  Substitute = 1,
  Insert = 2
}
