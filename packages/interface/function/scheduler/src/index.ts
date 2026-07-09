import {Enqueuer} from "@spica-server/function-enqueuer";
import {EventQueue, Queue} from "@spica-server/function-queue";
import {ClassCommander, JobReducer} from "@spica-server/replication";
import {CorsOptions} from "@spica-server/interface-core";
import {event} from "@spica-server/function-queue-proto";

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
  eventConcurrency?: number;
  maxWarmWorkers: number;
  debug: boolean;
  logger: boolean;
  invocationLogs: boolean;
  workerLogOutput?: ("database" | "stdout")[];
  spawnEntrypointPath?: string;
  tsCompilerPath?: string;
  grpcPort?: number;
  functionGrpcMaxMessageSizeBytes?: number;
  payloadSizeLimit?: number;
}

export type Schedule = (event: event.Event) => void;

// A function runs one event per worker at a time unless it opts into more. This is the
// baseline used everywhere concurrency is defaulted: the scheduler stores only functions
// ABOVE this value (a sparse map) and reads back `?? DEFAULT_EVENT_CONCURRENCY`.
export const DEFAULT_EVENT_CONCURRENCY = 1;

export enum WorkerState {
  "Initial",
  "Fresh",
  "Targeted",
  "Busy",
  "Timeouted",
  "Outdated",
  "Warming",
  "Warm"
}

export const ENQUEUER = Symbol.for("SCHEDULER_ENQUEUER");

export const SCHEDULING_OPTIONS = Symbol.for("SCHEDULING_OPTIONS");
