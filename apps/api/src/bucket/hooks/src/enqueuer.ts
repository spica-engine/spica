import {Enqueuer} from "@spica-server/function/enqueuer";
import {EventQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";
import {hooks} from "@spica-server/bucket/hooks/proto";
import {ChangeQueue} from "./queue";
import {ChangeEmitter, changeKey} from "./emitter";
import uniqid from "uniqid";
import {ClassCommander, JobReducer} from "@spica-server/replication";
import {CommandType} from "@spica-server/interface/replication";
import {ChangeOptions} from "@spica-server/interface/bucket/hooks";
import {Description} from "@spica-server/interface/function/enqueuer";

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

  description: Description = {
    icon: "view_agenda",
    name: "bucket",
    title: "Bucket",
    description: "Capture the things that happen in data endpoints."
  };

  private changeTargets = new Map<
    string,
    {options: ChangeOptions; handler: (type, documentKey, previous, current) => void}
  >();

  constructor(
    private queue: EventQueue,
    private changeQueue: ChangeQueue,
    private changeEmitter: ChangeEmitter,
    private jobReducer?: JobReducer,
    private commander?: ClassCommander
  ) {
    super();
    if (this.commander) {
      this.commander = this.commander.new();
      this.commander.register(this, [this.shift], CommandType.SHIFT);
    }
  }

  subscribe(target: event.Target, options: ChangeOptions) {
    const changeHandler = (type, documentKey, previous, current) =>
      this.onChangeHandler({type, documentKey, previous, current}, target);

    this.changeTargets.set(this.getTargetKey(target), {
      options,
      handler: changeHandler
    });
    this.changeEmitter.on(changeKey(options.bucket, options.type), changeHandler);
  }

  unsubscribe(target: event.Target) {
    for (const [actionTarget, {handler, options}] of this.changeTargets) {
      const _actionTarget = JSON.parse(actionTarget);
      if (
        (!target.handler && _actionTarget.cwd == target.cwd) ||
        (target.handler &&
          _actionTarget.cwd == target.cwd &&
          _actionTarget.handler == target.handler)
      ) {
        this.changeTargets.delete(actionTarget);
        this.changeEmitter.off(changeKey(options.bucket, options.type), handler);
      }
    }
  }

  onChangeHandler(rawChange, target: event.Target, eventId?: string) {
    const {options} = this.changeTargets.get(this.getTargetKey(target));

    const ev = new event.Event({
      id: eventId || uniqid(),
      target,
      type: event.Type.BUCKET
    });
    const change = new hooks.Change({
      bucket: options.bucket,
      kind: getChangeType(rawChange.type),
      documentKey: rawChange.documentKey,
      previous: JSON.stringify(rawChange.previous),
      current: JSON.stringify(rawChange.current)
    });

    const enqueue = () => {
      this.queue.enqueue(ev);
      this.changeQueue.enqueue(ev.id, change);
    };

    if (this.jobReducer) {
      this.jobReducer.do({...rawChange, event_id: ev.id, _id: ev.id}, enqueue);
    } else {
      enqueue();
    }
    return;
  }

  onEventsAreDrained(events: event.Event[]) {
    if (!this.jobReducer) {
      return;
    }

    const shiftPromises: Promise<any>[] = [];

    for (const event of events) {
      const shift = this.jobReducer.findOneAndDelete({event_id: event.id}).then(job => {
        if (!job) {
          console.error(`Job ${event.id} does not exist!`);
          return;
        }
        const newChange = {...job, _id: {_data: job._id}};
        return this.shift(newChange, event.target.toObject(), event.id);
      });

      shiftPromises.push(shift);
    }

    return Promise.all(shiftPromises);
  }

  private shift(
    rawChange,
    target: {
      id: string;
      cwd: string;
      handler: string;
      context: {
        env: {
          key: string;
          value: string;
        }[];
        timeout: number;
      };
    },
    eventId: string
  ) {
    // move this method to the parent class
    const newTarget = new event.Target({
      id: target.id,
      cwd: target.cwd,
      handler: target.handler,
      context: new event.SchedulingContext({
        env: Object.keys(target.context.env).reduce((envs, key) => {
          envs.push(
            new event.SchedulingContext.Env({
              key,
              value: target.context.env[key]
            })
          );
          return envs;
        }, []),
        timeout: target.context.timeout
      })
    });
    return this.onChangeHandler(rawChange, newTarget, eventId);
  }

  getTargetKey(target: event.Target) {
    return JSON.stringify(target.toObject());
  }
}
