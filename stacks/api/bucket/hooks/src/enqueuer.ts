import {Description, Enqueuer} from "@spica-server/function/enqueuer";
import {EventQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";
import {BucketEnqueuerOptions, BucketAction} from "./interface";

export class BucketEnqueuer extends Enqueuer<BucketEnqueuerOptions> {
  description: Description = {
    icon: "view_agenda",
    name: "bucket",
    title: "Before",
    description: "Catch up events before happen in bucket-data"
  };

  private actions: BucketAction[] = [];

  constructor(private queue: EventQueue) {
    super();
  }

  startToRun(options: BucketEnqueuerOptions) {
    this.actions.forEach(action => {
      if (action.options.collection == options.collection && action.options.type == options.type) {
        this.queue.enqueue(
          new Event.Event({
            //use -1 until create type
            type: -1,
            target: action.target
          })
        );
      }
    });
  }

  subscribe(target: Event.Target, options: BucketEnqueuerOptions) {
    this.actions.push({target: target, options: options});
  }
  unsubscribe(target: Event.Target) {
    for (const action of this.actions) {
      if (
        (!target.handler && action.target.cwd == target.cwd) ||
        (target.handler &&
          action.target.cwd == target.cwd &&
          action.target.handler == target.handler)
      ) {
        this.actions.splice(this.actions.indexOf(action), 1);
      }
    }
  }
}
