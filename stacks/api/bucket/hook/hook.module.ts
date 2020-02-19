import {Module, Global} from "@nestjs/common";
import {BucketService} from "@spica-server/bucket/services/bucket.service";
import {ServicesModule} from "@spica-server/bucket/services/bucket.service.module";

const provideScheduler = (queueu: any) => {
  return {
    enqueuer: null,
    queue: null
  };
};

async function createSchema(service: BucketService) {
    return {};
}

export const SCHEMA = "SCHEMA";
export const SCHEDULER = "HORIZON_SCHEDULER";

export const hookModuleProviders = [
  {
    provide: SCHEDULER,
    useFactory: provideScheduler
  },
  {
    provide: SCHEMA,
    useFactory: (service: BucketService) => {
      return createSchema(service);
    },
    inject: [BucketService]
  }
];

@Global()
@Module({
  imports: [ServicesModule],
  providers: hookModuleProviders,
  exports: [SCHEDULER, SCHEMA]
})
export class HookModule {}
