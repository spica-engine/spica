import {ProfilerQuery} from "@spica-server/interface-data";

interface ProfilerCursor {
  limit(value: number): unknown;
  skip(value: number): unknown;
  sort(value: any): unknown;
  toArray(): Promise<unknown[]>;
}

export function readProfiler(cursor: ProfilerCursor, query: ProfilerQuery) {
  if (query.limit) {
    cursor.limit(query.limit);
  }

  if (query.skip) {
    cursor.skip(query.skip);
  }

  if (query.sort) {
    cursor.sort(query.sort);
  }

  return cursor.toArray();
}
