export interface HorizonOptions {
  poolSize: number;
  databaseUri: string;
  databaseName: string;
  databaseReplicaSet: string;
  publicUrl: string;
  timeout: number;
}

export const HORIZON_OPTIONS = Symbol.for("HORIZON_OPTIONS");
