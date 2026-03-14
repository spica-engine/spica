import {Global, Module} from "@nestjs/common";
import {BucketService, ServicesModule} from "@spica-server/bucket/services";
import {DatabaseService, ObjectId} from "@spica-server/database";
import {SCHEMA, COLL_SLUG} from "@spica-server/interface/function";
import {EventQueue} from "@spica-server/function/queue";
import {ENQUEUER} from "@spica-server/interface/function/scheduler";
import {JSONSchema7} from "json-schema";
import {ChangeEmitter} from "./emitter";
import {ChangeEnqueuer} from "./enqueuer";
import {ChangeQueue} from "./queue";
import {ClassCommander, JobReducer} from "@spica-server/replication";

export function createSchema(db: DatabaseService): Promise<JSONSchema7> {
  const slugs = new Map<string, string>();
  return db
    .collection("buckets")
    .find({})
    .toArray()
    .then(buckets => {
      for (const bucket of buckets) {
        slugs.set(bucket._id.toString(), bucket.title);
      }

      const schema: JSONSchema7 = {
        $id: "http://spica.internal/function/enqueuer/bucket",
        type: "object",
        required: ["bucket", "type"],
        properties: {
          bucket: {
            // empty enums are not allowed on schema but the client will be able to send any value if enums are empty, it's a bit weird solution to solve this problem
            enum: slugs.size ? Array.from(slugs.keys()) : [null],
            // @ts-ignore
            viewEnum: slugs.size ? Array.from(slugs.values()) : [null],
            title: "Bucket",
            type: "string",
            description: "Bucket id that the event will be tracked on"
          },
          type: {
            title: "Operation type",
            type: "string",
            enum: ["ALL", "INSERT", "UPDATE", "DELETE"],
            description: "Operation type that must be performed in the specified bucket"
          }
        },
        additionalProperties: false
      };

      return schema;
    });
}

export const collectionSlugFactory = (bs: BucketService) => {
  return (collName: string) => {
    const id = bs.collNameToId(collName);
    if (!id) {
      return Promise.resolve(collName);
    }
    return bs.findOne(new ObjectId(id)).then(b => (b ? b.title : collName));
  };
};

@Global()
@Module({
  imports: [ServicesModule],
  exports: [ENQUEUER, SCHEMA, COLL_SLUG, ChangeEmitter],
  providers: [
    ChangeEmitter,
    {
      provide: ENQUEUER,
      useFactory: (changeEmitter: ChangeEmitter) => {
        return (queue: EventQueue, jobReducer?, commander?) => {
          const changeQueue = new ChangeQueue();
          const changeEnqueuer = new ChangeEnqueuer(
            queue,
            changeQueue,
            changeEmitter,
            jobReducer,
            commander
          );
          return {
            enqueuer: changeEnqueuer,
            queue: changeQueue
          };
        };
      },
      inject: [ChangeEmitter]
    },
    {
      provide: SCHEMA,
      useFactory: (db: DatabaseService) => {
        return {name: "bucket", schema: () => createSchema(db)};
      },
      inject: [DatabaseService]
    },
    {
      provide: COLL_SLUG,
      useFactory: collectionSlugFactory,
      inject: [BucketService]
    }
  ]
})
export class HookModule {}
