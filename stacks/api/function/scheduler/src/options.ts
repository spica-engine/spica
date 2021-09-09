import {CorsOptions} from "@spica-server/core/interfaces";

export interface SchedulingOptions {
  databaseUri: string;
  databaseName: string;
  databaseReplicaSet: string;
  apiUrl: string;
  timeout: number;
  experimentalDevkitDatabaseCache?: boolean;
  corsOptions: CorsOptions;
  maxConcurrency: number;
}

export const SCHEDULING_OPTIONS = Symbol.for("SCHEDULING_OPTIONS");
