import {Global, Module} from "@nestjs/common";
import {BucketService, ServicesModule} from "@spica-server/bucket/services";
import {SCHEMA} from "@spica-server/function";
import {SCHEDULER} from "@spica-server/function/horizon";
import {EventQueue} from "@spica-server/function/queue";
import {JSONSchema7} from "json-schema";
import {ActionDispatcher} from "./dispatcher";
import {ActionEnqueuer} from "./enqueuer";
import {ActionQueue} from "./queue";

function createSchema(service: BucketService) {
  return service.find({}).then(buckets => {
    const scheme: JSONSchema7 = {
      $id: "http://spica.internal/function/enqueuer/bucket",
      type: "object",
      required: ["bucket", "type"],
      properties: {
        bucket: {
          title: "Bucket ID",
          type: "string",
          enum: buckets.map(c => c._id.toHexString()).sort((a, b) => a.localeCompare(b))
        },
        type: {
          title: "Operation type",
          description: "Event Type",
          type: "string",
          enum: ["INSERT", "INDEX", "GET", "UPDATE"]
        }
      },
      additionalProperties: false
    };
    return scheme;
  });
}

export const hookModuleProviders = [
  ActionDispatcher,
  {
    provide: SCHEDULER,
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
  exports: [SCHEDULER, SCHEMA, ActionDispatcher]
})
export class HookModule {}
