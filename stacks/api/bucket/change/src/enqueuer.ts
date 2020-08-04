import {Description, Enqueuer} from "@spica-server/function/enqueuer";
import {EventQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";
import {DataChange} from "@spica-server/bucket/change/proto";
import {changeKey, DataChangeEmitter} from "./emitter";
import {DataChangeQueue} from "./queue";

export interface ChangeOptions {
  bucket: string;
  type: string;
}

function getKindFromType(type: string): DataChange.Change.Kind {
  switch (type) {
    case "insert":
      return DataChange.Change.Kind.INSERT;
    case "delete":
      return DataChange.Change.Kind.DELETE;
    case "update":
      return DataChange.Change.Kind.UPDATE;
    case "replace":
      return DataChange.Change.Kind.REPLACE;
    default:
      throw new Error(`Invalid type received. ${type}`);
  }
}

export class DataChangeEnqueuer extends Enqueuer<ChangeOptions> {
  description: Description = {
    icon: "view_agenda",
    name: "bucket_data",
    title: "Bucket Data",
    description: "Catch up to events that happen in bucket datas."
  };

  private targets = new Map<
    Event.Target,
    {options: ChangeOptions; handler: (type, documentKey, previous, current) => void}
  >();

  constructor(
    private queue: EventQueue,
    private changeQueue: DataChangeQueue,
    private emitter: DataChangeEmitter
  ) {
    super();
  }

  subscribe(target: Event.Target, options: ChangeOptions) {
    const enqueuer = (type, documentKey, previous, current) => {
      const event = new Event.Event({
        target,
        type: Event.Type.BUCKET_DATA
      });
      this.queue.enqueue(event);
      this.changeQueue.enqueue(
        event.id,
        new DataChange.Change({
          bucket: options.bucket,
          kind: getKindFromType(type),
          documentKey: documentKey,
          previous: JSON.stringify(previous),
          current: JSON.stringify(current)
        })
      );
    };
    this.targets.set(target, {options, handler: enqueuer});
    this.emitter.on(changeKey(options.bucket, options.type), enqueuer);
  }

  unsubscribe(target: Event.Target) {
    for (const [actionTarget, {handler, options}] of this.targets) {
      if (
        (!target.handler && actionTarget.cwd == target.cwd) ||
        (target.handler && actionTarget.cwd == target.cwd && actionTarget.handler == target.handler)
      ) {
        this.targets.delete(actionTarget);
        this.emitter.off(changeKey(options.bucket, options.type), handler);
      }
    }
  }
}
