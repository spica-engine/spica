import {CorsOptions} from "@spica/core";

export interface SchedulingOptions {
  databaseUri: string;
  databaseName: string;
  databaseReplicaSet: string;
  apiUrl: string;
  timeout: number;
  experimentalDevkitDatabaseCache?: boolean;
  corsOptions: CorsOptions;
  maxConcurrency: number;
  debug: boolean;
  logger: boolean;
}

export const SCHEDULING_OPTIONS = Symbol.for("SCHEDULING_OPTIONS");
