export interface HorizonOptions {
  poolSize: number;
  databaseUri: string;
  databaseName: string;
  databaseReplicaSet: string;
  publicUrl: string;
}

export const HORIZON_OPTIONS = Symbol.for("HORIZON_OPTIONS");
