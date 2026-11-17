export type Row = Record<string, unknown>;

export interface RowSet {
  main: Row;
  children?: Record<string, Row[]>;
  joined?: Record<string, RowSet | RowSet[] | null>;
}

export const fieldKey = (path: string[]) => path.join(".");

export const isRowSet = (value: unknown): value is RowSet =>
  typeof value == "object" &&
  value !== null &&
  typeof (value as RowSet).main == "object" &&
  (value as RowSet).main !== null;
