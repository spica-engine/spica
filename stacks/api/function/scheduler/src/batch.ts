import {event} from "@spica-server/function/queue/proto";

export interface Batch {
  target: string;
  workerId: string;
  schedule: (event: event.Event) => void;
  started_at: number;
  deadline: number;
  remaining_enqueues: {
    [k: string]: number;
  };
  last_enqueued_at: {
    [k: string]: number;
  };
}

export function updateBatch(batch: Batch, target: event.Target) {
  batch.remaining_enqueues[target.handler] =
    batch.remaining_enqueues[target.handler] || target.context.batch.limit;
  batch.remaining_enqueues[target.handler] = batch.remaining_enqueues[target.handler] - 1;
  batch.last_enqueued_at[target.handler] = Date.now();
  batch.deadline = Math.max(batch.deadline, Date.now() + target.context.batch.deadline * 1000);
}

export function createBatch(
  target: event.Target,
  workerId: string,
  schedule: (event: event.Event) => void
) {
  return {
    schedule,
    workerId,
    target: target.id,
    started_at: Date.now(),
    deadline: Date.now(),
    remaining_enqueues: {
      [target.handler]: target.context.batch.limit
    },
    last_enqueued_at: {
      [target.handler]: Date.now()
    }
  };
}
