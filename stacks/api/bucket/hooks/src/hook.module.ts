import {Global, Module} from "@nestjs/common";
import {BucketService, ServicesModule} from "@spica-server/bucket/services";
import {EventQueue} from "@spica-server/function/queue";
import {JSONSchema7} from "json-schema";
import {Scheduler} from "./scheduler";
import {BucketEnqueuer} from "./enqueuer";
import {BucketEnqueuerOptions} from "./interface";

function createSchema(service: BucketService) {
  return service.find({}).then(buckets => {
    const scheme: JSONSchema7 = {
      $id: "http://spica.internal/function/enqueuer/bucket",
      type: "object",
      required: ["collection", "type"],
      properties: {
        collection: {
          title: "Bucket ID",
          type: "string",
          enum: buckets.map(c => c._id.toHexString()).sort((a, b) => a.localeCompare(b))
        },
        type: {
          title: "Operation type",
          description: "Event Type",
          type: "string",
          enum: ["INSERT", "UPDATE", "GET", "INDEX"]
        }
      },
      additionalProperties: false
    };
    return scheme;
  });
}

export const SCHEMA = "SCHEMA";
export const SCHEDULER = "HORIZON_SCHEDULER";

export const hookModuleProviders = [
  {
    provide: SCHEDULER,
    useFactory: (scheduler: Scheduler) => {
      return (queue: EventQueue) => {
        const enqueuer = new BucketEnqueuer(queue);
        scheduler.stream.subscribe((options: BucketEnqueuerOptions) => {
          enqueuer.startToRun(options);
        });
        return {
          enqueuer,
          queue: null
        };
      };
    },
    inject: [Scheduler]
  },
  Scheduler,
  {
    provide: SCHEMA,
    useFactory: (service: BucketService) => {
      return {name: "bucket", schema: () => createSchema(service)};
    },
    inject: [BucketService]
  }
];

@Global()
@Module({
  imports: [ServicesModule],
  providers: hookModuleProviders,
  exports: [SCHEDULER, SCHEMA, Scheduler]
})
export class HookModule {}
