import {Global, Module} from "@nestjs/common";
import {ServicesModule} from "@spica-server/bucket/services";
import {DatabaseService} from "@spica-server/database";
import {SCHEMA} from "@spica-server/function";
import {ENQUEUER} from "@spica-server/function/scheduler";
import {EventQueue} from "@spica-server/function/queue";
import {JSONSchema7} from "json-schema";
import {Observable} from "rxjs";
import {ReviewDispatcher} from "./dispatcher";
import {ChangeAndReviewEnqueuer} from "./enqueuer";
import {ChangeAndReviewQueue} from "./queue";
import {ChangeEmitter} from "./emitter";

export function createSchema(db: DatabaseService): Observable<JSONSchema7> {
  return new Observable(observer => {
    const buckets = new Map<string, string>();

    const notifyChanges = () => {
      const schema: JSONSchema7 = {
        $id: "http://spica.internal/function/enqueuer/bucket",
        type: "object",
        required: ["bucket", "phase", "type"],
        properties: {
          bucket: {
            title: "Bucket",
            type: "string",
            enum: Array.from(buckets.keys()),
            // @ts-expect-error
            viewEnum: Array.from(buckets.values())
          },
          phase: {
            title: "Phase",
            type: "string",
            enum: ["BEFORE", "AFTER"]
          },
          type: {
            type: "string"
          }
        },
        if: {
          properties: {
            phase: {const: "BEFORE"}
          }
        },
        then: {
          properties: {
            type: {
              title: "Operation type",
              type: "string",
              enum: ["INSERT", "INDEX", "GET", "UPDATE", "DELETE", "STREAM"]
            }
          }
        },
        else: {
          properties: {
            type: {
              title: "Operation type",
              type: "string",
              enum: ["INSERT", "UPDATE", "DELETE"]
            }
          }
        },
        additionalProperties: false
      };
      observer.next(schema);
    };

    const stream = db.collection("buckets").watch(
      [
        {
          $match: {
            $or: [{operationType: "insert"}, {operationType: "delete"}]
          }
        }
      ],
      {fullDocument: "updateLookup"}
    );

    stream.on("change", change => {
      switch (change.operationType) {
        case "delete":
          buckets.delete(change.documentKey._id.toString());
          notifyChanges();
          break;
        case "insert":
          if (!buckets.has(change.documentKey._id.toString())) {
            buckets.set(change.documentKey._id.toString(), change.fullDocument.title);
            notifyChanges();
          }
          break;
      }
    });

    stream.on("close", () => observer.complete());

    db.collection("buckets")
      .find({})
      .toArray()
      .then(_buckets => {
        for (const bucket of _buckets) {
          buckets.set(bucket._id.toString(), bucket.title);
        }
        notifyChanges();
      });

    return () => {
      stream.close();
    };
  });
}

@Global()
@Module({
  imports: [ServicesModule],
  exports: [ENQUEUER, SCHEMA, ReviewDispatcher, ChangeEmitter],
  providers: [
    ReviewDispatcher,
    ChangeEmitter,
    {
      provide: ENQUEUER,
      useFactory: (reviewDispatcher: ReviewDispatcher, changeEmitter: ChangeEmitter) => {
        return (queue: EventQueue) => {
          const changeAndReviewQueue = new ChangeAndReviewQueue();
          const changeAndReviewEnqueuer = new ChangeAndReviewEnqueuer(
            queue,
            changeAndReviewQueue,
            reviewDispatcher,
            changeEmitter
          );
          return {
            enqueuer: changeAndReviewEnqueuer,
            queue: changeAndReviewQueue
          };
        };
      },
      inject: [ReviewDispatcher, ChangeEmitter]
    },
    {
      provide: SCHEMA,
      useFactory: (db: DatabaseService) => {
        return {name: "bucket", schema: () => createSchema(db)};
      },
      inject: [DatabaseService]
    }
  ]
})
export class HookModule {}
