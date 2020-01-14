import {ChangeStream, DatabaseService} from "@spica-server/database";
import {DatabaseQueue, EventQueue} from "@spica-server/function/queue";
import {Database, Event} from "@spica-server/function/queue/proto";
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
    private db: DatabaseService
  ) {
    super();
  }

  subscribe(target: Event.Target, options: DatabaseOptions): void {
    const stream = this.db.collection(options.collection).watch(
      [
        {
          $match: {operationType: options.type.toLowerCase()}
        }
      ],
      {fullDocument: "updateLookup"}
    );

    stream.on("change", rawChange => {
      const change = new Database.Change();
      change.kind = getChangeKind(rawChange.operationType);
      change.document = rawChange.fullDocument ? JSON.stringify(rawChange.fullDocument) : undefined;
      change.documentKey = rawChange.documentKey._id.toString();
      change.collection = rawChange.ns.coll;
      if (change.kind == Database.Change.Kind.UPDATE) {
        change.updateDescription = new Database.Change.UpdateDescription();
        change.updateDescription.removedFields = JSON.stringify(
          rawChange.updateDescription.removedFields
        );
        change.updateDescription.updatedFields = JSON.stringify(
          rawChange.updateDescription.updatedFields
        );
      }
      const event = new Event.Event();
      event.target = target;
      event.type = Event.Type.DATABASE;
      this.queue.enqueue(event);

      this.databaseQueue.enqueue(event.id, change);
    });

    Object.defineProperty(stream, "target", {writable: false, value: target});

    this.streams.add(stream);
  }

  unsubscribe(target: Event.Target): void {
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
