import {Module, Global} from "@nestjs/common";
import {BucketService} from "../bucket.service";

const provideScheduler = (queueu: any) => {
  return {
    enqueuer: null,
    queue: null
  };
};

const provideSchema = {
  name: "bucket",
  schema: this.createSchema()
};

async function createSchema(service: BucketService) {
  const bucket = await service.buckets;
  return {bucket};
}

const SCHEMA = "SCHEMA";
const SCHEDULER = "HORIZON_SCHEDULER";

@Global()
@Module({
  providers: [
    {
      provide: SCHEDULER,
      useValue: provideScheduler
    },
    {
      provide: SCHEMA,
      useFactory: service => {
        return createSchema(service);
      },
      inject: [BucketService]
    }
  ],
  exports: [SCHEDULER, SCHEMA]
})
export class HookModule {}
