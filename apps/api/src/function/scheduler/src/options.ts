import {CorsOptions} from "@spica-server/core";

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
  spawnEntrypointPath?: string;
  tsCompilerPath?: string;
}

export const SCHEDULING_OPTIONS = Symbol.for("SCHEDULING_OPTIONS");
