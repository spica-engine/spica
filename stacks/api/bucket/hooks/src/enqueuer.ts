import {Description, Enqueuer} from "@spica-server/function/enqueuer";
import {EventQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";
import * as action from "../proto/action";
import {ActionDispatcher, actionKey} from "./dispatcher";
import {ActionQueue} from "./queue";

interface ActionOptions {
  bucket: string;
  type: "INSERT" | "UPDATE" | "GET" | "INDEX";
}

export class ActionEnqueuer extends Enqueuer<ActionOptions> {
  description: Description = {
    icon: "view_agenda",
    name: "bucket",
    title: "Before",
    description: "Catch up events before happen in bucket-data"
  };

  private targets = new Map<Event.Target, ActionOptions>();

  constructor(
    private queue: EventQueue,
    private actionQueue: ActionQueue,
    private dispatcher: ActionDispatcher
  ) {
    super();
  }

  subscribe(target: Event.Target, options: ActionOptions) {
    this.targets.set(target, options);
    console.log("dsadas", actionKey(options.bucket, options.type));
    this.dispatcher.on(actionKey(options.bucket, options.type), (callback, req) => {
      console.log(req);
      const event = new Event.Event({
        target,
        type: Event.Type.BUCKET
      });
      this.queue.enqueue(event);
      this.actionQueue.enqueue(
        event.id,
        new action.Action({
          bucket: "dwqwqd",
          document: "dwqdwq",
          type: action.Action.Type.INDEX
        }),
        callback
      );
    });
  }

  unsubscribe(target: Event.Target) {
    for (const [actionTarget] of this.targets) {
      if (
        (!target.handler && actionTarget.cwd == target.cwd) ||
        (target.handler && actionTarget.cwd == target.cwd && actionTarget.handler == target.handler)
      ) {
        this.targets.delete(actionTarget);
      }
    }
  }
}
