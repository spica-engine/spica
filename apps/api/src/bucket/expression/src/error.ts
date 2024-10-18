export class TypeError extends Error {
  readonly column: number;
  readonly line: number;

  constructor({message, column, line}: {line?: number; column?: number; message: string}) {
    super(message);
    this.column = column;
    this.line = line;
  }
}
