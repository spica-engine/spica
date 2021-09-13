export const FUNCTION_OPTIONS = Symbol.for("FUNCTION_OPTIONS");

export interface Options {
  timeout: number;
  root: string;
}

export interface FunctionOptions {
  path: string;
  logExpireAfterSeconds: number;
  entryLimit?: number;
  realtimeLogs: boolean;
}
