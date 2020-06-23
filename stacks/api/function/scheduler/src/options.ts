export interface SchedulingOptions {
  poolSize: number;
  databaseUri: string;
  databaseName: string;
  databaseReplicaSet: string;
  publicUrl: string;
  timeout: number;
}

export const SCHEDULING_OPTIONS = Symbol.for("SCHEDULING_OPTIONS");
