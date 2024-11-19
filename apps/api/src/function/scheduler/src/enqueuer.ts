import {Enqueuer} from "@spica/api/src/function/enqueuer";
import {EventQueue, Queue} from "@spica/api/src/function/queue";
import {ClassCommander, JobReducer} from "@spica/api/src/replication";

export const ENQUEUER = Symbol.for("SCHEDULER_ENQUEUER");

export type EnqueuerFactory<QueueType, OptionsT> = (
  queue: EventQueue,
  jobReducer?: JobReducer,
  commander?: ClassCommander
) => {queue: Queue<QueueType>; enqueuer: Enqueuer<OptionsT>};
