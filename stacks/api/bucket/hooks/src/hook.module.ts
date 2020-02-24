import {Global, Module} from "@nestjs/common";
import {BucketService, ServicesModule} from "@spica-server/bucket/services";
import {Description, Enqueuer} from "@spica-server/function/enqueuer";
import {EventQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";
import {JSONSchema7} from "json-schema";
import {Scheduler} from "./scheduler";

export interface BucketEnqueuerOptions {
  collection: string;
  type: "INSERT" | "UPDATE" | "GET" | "INDEX";
}

interface Action {
  target: Event.Target;
  options: BucketEnqueuerOptions;
}

export class BucketEnqueuer extends Enqueuer<BucketEnqueuerOptions> {
  description: Description = {
    icon: "",
    name: "bucket",
    title: "Before",
    description: "Description of before trigger"
  };

  private actions: Action[] = [];

  constructor(private queue: EventQueue) {
    super();
  }

  startToRun(options: BucketEnqueuerOptions) {
    this.actions.forEach(action => {
      if (action.options.collection == options.collection && action.options.type == options.type) {
        this.queue.enqueue(
          new Event.Event({
            //use -1 until create type
            type: -1,
            target: action.target
          })
        );
      }
    });
  }

  subscribe(target: Event.Target, options: BucketEnqueuerOptions) {
    this.actions.push({target: target, options: options});
  }
  unsubscribe(target: Event.Target) {
    for (const action of this.actions) {
      if (
        //ask this logic
        (!target.handler && action.target.cwd == target.cwd) ||
        (target.handler &&
          action.target.cwd == target.cwd &&
          action.target.handler == target.handler)
      ) {
        this.actions.splice(this.actions.indexOf(action), 1);
      }
    }
  }
}

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
