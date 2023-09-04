import {Description, Enqueuer} from "@spica-server/function/enqueuer";
import {EventQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";
import {hooks} from "@spica-server/bucket/hooks/proto";
import {ChangeQueue} from "./queue";
import {ChangeEmitter, changeKey} from "./emitter";

export interface ChangeOptions {
  bucket: string;
  type: string;
}

function getChangeType(type: string): hooks.Change.Kind {
  switch (type) {
    case "insert":
      return hooks.Change.Kind.INSERT;
    case "delete":
      return hooks.Change.Kind.DELETE;
    case "update":
      return hooks.Change.Kind.UPDATE;
    default:
      throw new Error(`Invalid type received. ${type}`);
  }
}

export class ChangeEnqueuer extends Enqueuer<ChangeOptions> {
  type = event.Type.BUCKET;
  
  onEventsAreDrained(events: event.Event[]): Promise<any> {
    return Promise.resolve();
  }
  description: Description = {
    icon: "view_agenda",
    name: "bucket",
    title: "Bucket",
    description: "Capture the things that happen in data endpoints."
  };

  private changeTargets = new Map<
    event.Target,
    {options: ChangeOptions; handler: (type, documentKey, previous, current) => void}
  >();

  constructor(
    private queue: EventQueue,
    private changeQueue: ChangeQueue,
    private changeEmitter: ChangeEmitter
  ) {
    super();
  }

  subscribe(target: event.Target, options: ChangeOptions) {
    const enqueuer = (type, documentKey, previous, current) => {
      const ev = new event.Event({
        target,
        type: event.Type.BUCKET
      });
      this.queue.enqueue(ev);
      this.changeQueue.enqueue(
        ev.id,
        new hooks.Change({
          bucket: options.bucket,
          kind: getChangeType(type),
          documentKey: documentKey,
          previous: JSON.stringify(previous),
          current: JSON.stringify(current)
        })
      );
    };
    this.changeTargets.set(target, {options, handler: enqueuer});
    this.changeEmitter.on(changeKey(options.bucket, options.type), enqueuer);
  }

  unsubscribe(target: event.Target) {
    for (const [actionTarget, {handler, options}] of this.changeTargets) {
      if (
        (!target.handler && actionTarget.cwd == target.cwd) ||
        (target.handler && actionTarget.cwd == target.cwd && actionTarget.handler == target.handler)
      ) {
        this.changeTargets.delete(actionTarget);
        this.changeEmitter.off(changeKey(options.bucket, options.type), handler);
      }
    }
  }
}
