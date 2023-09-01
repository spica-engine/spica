import {ChangeStream, DatabaseService} from "@spica-server/database";
import {DatabaseQueue, EventQueue} from "@spica-server/function/queue";
import {Database, event} from "@spica-server/function/queue/proto";
import {JobReducer} from "@spica-server/replication";
import {Description, Enqueuer} from "./enqueuer";

interface DatabaseOptions {
  collection: string;
  type: "INSERT" | "UPDATE" | "REPLACE" | "DELETE";
}

export class DatabaseEnqueuer extends Enqueuer<DatabaseOptions> {
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
    private jobReducer?: JobReducer
  ) {
    super();
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

    const onChangeHandler = rawChange => {
      const onChange = () => {
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

        const ev = new event.Event({
          target,
          type: event.Type.DATABASE
        });
        this.queue.enqueue(ev);
        this.databaseQueue.enqueue(ev.id, change);
      };

      if (this.jobReducer) {
        this.jobReducer.do({...rawChange, _id: rawChange._id._data}, onChange);
      } else {
        onChange();
      }
      return;
    };
    stream.on("change", onChangeHandler);

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
