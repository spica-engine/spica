import {Enqueuer} from "@spica-server/function/enqueuer";
import {EventQueue, Queue} from "@spica-server/function/queue";

export const ENQUEUER = Symbol.for("SCHEDULER_ENQUEUER");

export const ENQUEUER1 = Symbol.for("SCHEDULER_ENQUEUER1");

export type EnqueuerFactory<QueueType, OptionsT> = (
  queue: EventQueue
) => {queue: Queue<QueueType>; enqueuer: Enqueuer<OptionsT>};
