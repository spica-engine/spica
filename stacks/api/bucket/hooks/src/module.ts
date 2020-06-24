import {Global, Module} from "@nestjs/common";
import {ServicesModule} from "@spica-server/bucket/services";
import {DatabaseService} from "@spica-server/database";
import {SCHEMA} from "@spica-server/function";
import {ENQUEUER} from "@spica-server/function/scheduler";
import {EventQueue} from "@spica-server/function/queue";
import {JSONSchema7} from "json-schema";
import {Observable} from "rxjs";
import {ActionDispatcher} from "./dispatcher";
import {ActionEnqueuer} from "./enqueuer";
import {ActionQueue} from "./queue";

export function createSchema(db: DatabaseService): Observable<JSONSchema7> {
  return new Observable(observer => {
    const bucketIds = new Set<string>();

    const notifyChanges = () => {
      const schema: JSONSchema7 = {
        $id: "http://spica.internal/function/enqueuer/bucket",
        type: "object",
        required: ["bucket", "type"],
        properties: {
          bucket: {
            title: "Bucket",
            type: "string",
            enum: Array.from(bucketIds)
          },
          type: {
            title: "Operation type",
            description: "Event Type",
            type: "string",
            enum: ["INSERT", "INDEX", "GET", "UPDATE", "DELETE", "STREAM"]
          }
        },
        additionalProperties: false
      };
      observer.next(schema);
    };

    const stream = db.collection("buckets").watch([
      {
        $match: {
          $or: [{operationType: "insert"}, {operationType: "delete"}]
        }
      }
    ]);

    stream.on("change", change => {
      switch (change.operationType) {
        case "delete":
          bucketIds.delete(change.documentKey._id.toString());
          notifyChanges();
          break;
        case "insert":
          if (!bucketIds.has(change.documentKey._id.toString())) {
            bucketIds.add(change.documentKey._id.toString());
            notifyChanges();
          }
          break;
      }
    });

    stream.on("close", () => observer.complete());

    db.collection("buckets")
      .find({})
      .toArray()
      .then(buckets => {
        for (const bucket of buckets) {
          bucketIds.add(bucket._id.toString());
        }
        notifyChanges();
      });

    return () => {
      stream.close();
    };
  });
}

export const hookModuleProviders = [
  ActionDispatcher,
  {
    provide: ENQUEUER,
    useFactory: (dispatcher: ActionDispatcher) => {
      return (queue: EventQueue) => {
        const actionQueue = new ActionQueue();
        const actionEnqueuer = new ActionEnqueuer(queue, actionQueue, dispatcher);
        return {
          enqueuer: actionEnqueuer,
          queue: actionQueue
        };
      };
    },
    inject: [ActionDispatcher]
  },
  {
    provide: SCHEMA,
    useFactory: (db: DatabaseService) => {
      return {name: "bucket", schema: () => createSchema(db)};
    },
    inject: [DatabaseService]
  }
];

@Global()
@Module({
  imports: [ServicesModule],
  providers: hookModuleProviders,
  exports: [ENQUEUER, SCHEMA, ActionDispatcher]
})
export class HookModule {}
