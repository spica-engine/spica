export function levenshtein(
  a: Set<string> | Array<string>,
  b: Set<string> | Array<string>
): {distance: number; sequence: Sequence[]} {
  a = Array.from(a);
  b = Array.from(b);
  const an = a.length;
  const bn = b.length;

  const matrix = new Array<number[]>(bn + 1);

  for (let m = 0; m <= bn; ++m) {
    let row = (matrix[m] = new Array<number>(an + 1));
    row[0] = m;
  }

  for (let n = 1; n <= an; ++n) {
    matrix[0][n] = n;
  }

  for (let m = 1; m <= bn; ++m) {
    for (let n = 1; n <= an; ++n) {
      if (b[m - 1] === a[n - 1]) {
        matrix[m][n] = matrix[m - 1][n - 1];
      } else {
        matrix[m][n] =
          Math.min(
            matrix[m - 1][n - 1], // substitution
            matrix[m][n - 1], // insertion
            matrix[m - 1][n] // deletion
          ) + 1;
      }
    }
  }

  let n = an,
    m = bn;

  const sequence = new Array<Sequence>();

  while (n != 0 || m != 0) {
    if (m - 1 < 0) {
      sequence.push({kind: SequenceKind.Insert, item: a[n - 1], at: n - 1});

      n--;
      continue;
    }

    if (n - 1 < 0) {
      sequence.push({kind: SequenceKind.Delete, item: b[m - 1], at: m - 1});
      m--;
      continue;
    }

    const deletion = matrix[m - 1][n],
      insertion = matrix[m][n - 1],
      substitution = matrix[m - 1][n - 1],
      min = Math.min(substitution, insertion, deletion);

    if (min == substitution) {
      if (substitution == matrix[m][n] - 1) {
        sequence.push({kind: SequenceKind.Substitute, item: b[m - 1], with: a[n - 1], at: m - 1});
      }
      m--;
      n--;
    } else if (min == insertion) {
      sequence.push({kind: SequenceKind.Insert, item: a[n - 1], at: n - 1});
      n--;
    } else if (min == deletion) {
      sequence.push({kind: SequenceKind.Delete, item: b[m - 1], at: m - 1});
      m--;
    }
  }

  return {distance: matrix[bn][an], sequence};
}

export interface Sequence {
  kind: SequenceKind;
  item: string;
  at: number;
  with?: string;
}

export enum SequenceKind {
  Delete = 0,
  Substitute = 1,
  Insert = 2
}
