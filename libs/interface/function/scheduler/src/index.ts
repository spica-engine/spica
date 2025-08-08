import {Enqueuer} from "../../../../../apps/api/src/function/enqueuer";
import {EventQueue, Queue} from "../../../../../apps/api/src/function/queue";
import {ClassCommander, JobReducer} from "../../../../../apps/api/src/replication";
import {CorsOptions} from "../../../core";
import {event} from "../../../../../apps/api/src/function/queue/proto";

export type EnqueuerFactory<QueueType, OptionsT> = (
  queue: EventQueue,
  jobReducer?: JobReducer,
  commander?: ClassCommander
) => {queue: Queue<QueueType>; enqueuer: Enqueuer<OptionsT>};

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
  invocationLogs: boolean;
  spawnEntrypointPath?: string;
  tsCompilerPath?: string;
}

export type Schedule = (event: event.Event) => void;

export enum WorkerState {
  "Initial",
  "Fresh",
  "Targeted",
  "Busy",
  "Timeouted",
  "Outdated"
}

export const ENQUEUER = Symbol.for("SCHEDULER_ENQUEUER");

export const SCHEDULING_OPTIONS = Symbol.for("SCHEDULING_OPTIONS");
