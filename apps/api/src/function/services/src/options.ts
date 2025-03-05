export const FUNCTION_OPTIONS = Symbol.for("FUNCTION_OPTIONS");

export const COLL_SLUG = Symbol.for("COLL_SLUG");

export type CollectionSlug = (collName: string) => Promise<string>;

export interface Options {
  timeout: number;
  root: string;
  outDir: string;
}

export interface FunctionOptions {
  path: string;
  logExpireAfterSeconds: number;
  entryLimit?: number;
  realtimeLogs: boolean;
}
