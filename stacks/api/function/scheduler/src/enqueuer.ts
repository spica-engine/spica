import {Enqueuer} from "@spica-server/function/enqueuer";
import {EventQueue, Queue} from "@spica-server/function/queue";
import { ClassCommander, JobReducer } from "@spica-server/replication";

export const ENQUEUER = Symbol.for("SCHEDULER_ENQUEUER");

export type EnqueuerFactory<QueueType, OptionsT> = (
  queue: EventQueue,jobReducer?:JobReducer,commander?:ClassCommander
) => {queue: Queue<QueueType>; enqueuer: Enqueuer<OptionsT>};
