export type RepositoryClass = new (...args: any[]) => unknown;

export type RepositoryClasses = Map<symbol, RepositoryClass>;

export const REPOSITORY_CLASSES = Symbol.for("SPICA_DATA_REPOSITORY_CLASSES");

export interface EntryStatus {
  limit?: number;
  current: number;
  unit: "count";
}

export interface ProfilerQuery {
  filter?: object;
  limit?: number;
  skip?: number;
  sort?: {[key: string]: 1 | -1};
}
