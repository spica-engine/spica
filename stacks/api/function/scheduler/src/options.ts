import {CorsOptions} from "@spica-server/core/interfaces";

export interface SchedulingOptions {
  poolSize: number;
  poolMaxSize: number;
  databaseUri: string;
  databaseName: string;
  databaseReplicaSet: string;
  publicUrl: string;
  timeout: number;
  experimentalDevkitDatabaseCache?: boolean;
  corsOptions: CorsOptions;
}

export const SCHEDULING_OPTIONS = Symbol.for("SCHEDULING_OPTIONS");
