import {CorsOptions} from "@spica-server/core/interfaces";

export interface SchedulingOptions {
  poolSize: number;
  poolMaxSize: number;
  databaseUri: string;
  databaseName: string;
  databaseReplicaSet: string;
  apiUrl: string;
  timeout: number;
  experimentalDevkitDatabaseCache?: boolean;
  corsOptions: CorsOptions;
  debug: boolean;
}

export const SCHEDULING_OPTIONS = Symbol.for("SCHEDULING_OPTIONS");
