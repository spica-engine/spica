import {Queue, EventQueue} from "@spica-server/function/queue";
import {Enqueuer} from "@spica-server/function/enqueuer";

export const SCHEDULER = "HORIZON_SCHEDULER";

export type Scheduler<QueueType, OptionsT> = (
  queue: EventQueue
) => {queue: Queue<QueueType>; enqueuer: Enqueuer<OptionsT>};
