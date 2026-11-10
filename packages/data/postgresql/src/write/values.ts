import {ColumnMetadata} from "../schema/index.js";

export const valueAt = (source: unknown, path: string[]) =>
  path.reduce<any>((value, segment) => value?.[segment], source);

export function toColumnValue(column: ColumnMetadata, value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }
  switch (column.type) {
    case "jsonb":
      return JSON.stringify(value);
    case "point": {
      const [x, y] = (value as {coordinates: number[]}).coordinates;
      return `(${x},${y})`;
    }
    case "bigint":
      return String(value);
    case "timestamptz":
      return value instanceof Date ? value : new Date(value as string);
    default:
      return value;
  }
}
