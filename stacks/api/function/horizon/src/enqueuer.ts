import {Enqueuer} from "@spica-server/function/enqueuer";
import {EventQueue, Queue} from "@spica-server/function/queue";

export const ENQUEUER = "HORIZON_SCHEDULER";

export type EnqueuerFactory<QueueType, OptionsT> = (
  queue: EventQueue
) => {queue: Queue<QueueType>; enqueuer: Enqueuer<OptionsT>};
