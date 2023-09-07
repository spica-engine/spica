import {ChangeStream, DatabaseService} from "@spica-server/database";
import {DatabaseQueue, EventQueue} from "@spica-server/function/queue";
import {Database, event} from "@spica-server/function/queue/proto";
import {JobReducer} from "@spica-server/replication";
import {Description, Enqueuer} from "./enqueuer";
import {ClassCommander} from "@spica-server/replication";

interface DatabaseOptions {
  collection: string;
  type: "INSERT" | "UPDATE" | "REPLACE" | "DELETE";
}

export class DatabaseEnqueuer extends Enqueuer<DatabaseOptions> {
  type = event.Type.DATABASE;

  description: Description = {
    title: "Database",
    name: "database",
    icon: "view_agenda",
    description: "Catch up the events happen in the database."
  };

  private streams = new Set<ChangeStream>();

  constructor(
    private queue: EventQueue,
    private databaseQueue: DatabaseQueue,
    private db: DatabaseService,
    private schedulerUnsubscription: (targetId: string) => void,
    private jobReducer?: JobReducer,
    private commander?: ClassCommander
  ) {
    super();
    if (this.commander) {
      this.commander.register(this, [this.shift]);
    }
  }

  subscribe(target: event.Target, options: DatabaseOptions): void {
    const stream = this.db.collection(options.collection).watch(
      [
        {
          $match: {operationType: options.type.toLowerCase()}
        }
      ],
      {fullDocument: "updateLookup"}
    );

    stream.on("change", change => this.onChangeHandler(change, target));

    Object.defineProperty(stream, "target", {writable: false, value: target});

    this.streams.add(stream);
  }

  unsubscribe(target: event.Target): void {
    this.schedulerUnsubscription(target.id);

    for (const stream of this.streams) {
      if (
        (!target.handler && stream["target"].cwd == target.cwd) ||
        (target.handler &&
          stream["target"].cwd == target.cwd &&
          stream["target"].handler == target.handler)
      ) {
        stream.close();
        this.streams.delete(stream);
      }
    }
  }

  onChangeHandler(rawChange, target: event.Target) {
    const onChange = () => {
      const ev = new event.Event({
        target,
        type: event.Type.DATABASE
      });
      this.queue.enqueue(ev);

      const change = new Database.Change({
        _id: new Database.Change.Id({_data: rawChange._id._data}),
        kind: getChangeKind(rawChange.operationType),
        document: rawChange.fullDocument ? JSON.stringify(rawChange.fullDocument) : undefined,
        documentKey: rawChange.documentKey._id.toString(),
        collection: rawChange.ns.coll
      });

      if (change.kind == Database.Change.Kind.UPDATE) {
        change.updateDescription = new Database.Change.UpdateDescription({
          removedFields: JSON.stringify(rawChange.updateDescription.removedFields),
          updatedFields: JSON.stringify(rawChange.updateDescription.updatedFields)
        });
      }

      this.databaseQueue.enqueue(ev.id, change);
    };
    if (this.jobReducer) {
      this.jobReducer.do({...rawChange, _id: rawChange._id._data}, onChange);
    } else {
      onChange();
    }
    return;
  }

  onEventsAreDrained(events: event.Event[]) {
    if (!this.jobReducer) {
      return;
    }

    const shiftPromises: Promise<any>[] = [];

    for (const event of events) {
      const change = this.databaseQueue.get(event.id);

      const shift = this.jobReducer.find({_id: change._id._data}).then(([job]) => {
        if (!job) {
          console.error(`Job ${change._id._data} does not exist!`);
          return;
        }
        const newChange = {...job, _id: {_data: job._id}};
        return this.shift(newChange, event.target.toObject());
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
    }
  ) {
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
    return this.onChangeHandler(rawChange, newTarget);
  }
}

function getChangeKind(type: "insert" | "update" | "replace" | "delete"): Database.Change.Kind {
  switch (type) {
    case "insert":
      return Database.Change.Kind.INSERT;
    case "delete":
      return Database.Change.Kind.DELETE;
    case "replace":
      return Database.Change.Kind.REPLACE;
    case "update":
      return Database.Change.Kind.UPDATE;
    default:
      throw new Error(`Invalid event type received ${type}`);
  }
}
