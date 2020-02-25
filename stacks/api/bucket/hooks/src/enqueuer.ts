import {Description, Enqueuer} from "@spica-server/function/enqueuer";
import {EventQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";
import {Action} from "../proto";
import {ActionDispatcher, actionKey} from "./dispatcher";
import {ActionQueue} from "./queue";

export interface ActionOptions {
  bucket: string;
  type: string;
}

export class ActionEnqueuer extends Enqueuer<ActionOptions> {
  description: Description = {
    icon: "view_agenda",
    name: "bucket",
    title: "Bucket",
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

  mapHeaders(data: Object) {
    let headers: Action.Header[] = [];
    Object.keys(data).forEach(key => {
      headers.push(
        new Action.Header({
          key: key,
          value: data[key]
        })
      );
    });
    return headers;
  }

  subscribe(target: Event.Target, options: ActionOptions) {
    this.targets.set(target, options);
    this.dispatcher.on(actionKey(options.bucket, options.type), (callback, headers, document) => {
      const event = new Event.Event({
        target,
        type: Event.Type.BUCKET
      });
      this.queue.enqueue(event);
      this.actionQueue.enqueue(
        event.id,
        new Action.Action({
          headers: this.mapHeaders(headers),
          bucket: options.bucket,
          type: Action.Action.Type[options.type],
          document: document
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
