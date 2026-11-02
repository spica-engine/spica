import {ColumnType} from "../schema/index.js";

export type Document = Record<string, unknown>;

const isPlainObject = (value: unknown): value is Document =>
  typeof value == "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);

export function isVacant(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length == 0;
  }
  return isPlainObject(value) && Object.values(value).every(isVacant);
}

export function normalize(value: unknown, type: ColumnType | undefined, locationType?: string) {
  if (value === null || value === undefined) {
    return null;
  }
  if (type == "bigint") {
    return String(value);
  }
  if (type == "point") {
    const {x, y} = value as {x: number; y: number};
    return {type: locationType ?? "Point", coordinates: [x, y]};
  }
  return value;
}

export function byPosition<T extends Record<string, unknown>>(rows: T[], column: string): T[] {
  return [...rows].sort((a, b) => Number(a[column]) - Number(b[column]));
}
