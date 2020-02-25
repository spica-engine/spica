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

export function mapHeaders(data: Object) {
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

export class ActionEnqueuer extends Enqueuer<ActionOptions> {
  description: Description = {
    icon: "view_agenda",
    name: "bucket",
    title: "Bucket",
    description: "Control the things that happen in data endpoints."
  };

  private targets = new Map<
    Event.Target,
    {options: ActionOptions; handler: (callback, headers, document) => void}
  >();

  constructor(
    private queue: EventQueue,
    private actionQueue: ActionQueue,
    private dispatcher: ActionDispatcher
  ) {
    super();
  }

  subscribe(target: Event.Target, options: ActionOptions) {
    const handler = (callback, headers, document) => {
      const event = new Event.Event({
        target,
        type: Event.Type.BUCKET
      });
      this.queue.enqueue(event);
      this.actionQueue.enqueue(
        event.id,
        new Action.Action({
          headers: mapHeaders(headers),
          bucket: options.bucket,
          type: Action.Action.Type[options.type],
          document: document
        }),
        callback
      );
    };
    this.targets.set(target, {options, handler: handler});
    this.dispatcher.on(actionKey(options.bucket, options.type), handler);
  }

  unsubscribe(target: Event.Target) {
    for (const [actionTarget, {handler, options}] of this.targets) {
      if (
        (!target.handler && actionTarget.cwd == target.cwd) ||
        (target.handler && actionTarget.cwd == target.cwd && actionTarget.handler == target.handler)
      ) {
        this.targets.delete(actionTarget);
        this.dispatcher.off(actionKey(options.bucket, options.type), handler);
      }
    }
  }
}
