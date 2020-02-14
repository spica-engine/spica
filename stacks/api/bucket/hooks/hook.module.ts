import {Module, Global} from "@nestjs/common";
import {SCHEDULER, Scheduler} from "@spica-server/function/horizon";
import {SCHEMA} from "@spica-server/function";

export const provideHookScheduler: Scheduler<unknown, unknown> = () => {
  return {
    enqueuer: null,
    queue: null
  };
};

@Global()
@Module({
  providers: [
    {
      provide: SCHEDULER,
      useValue: provideHookScheduler
    },
    {
      provide: SCHEMA,
      useFactory: () => {
        return {name: "bucket", schema: {}};
      }
    }
  ],
  exports: [SCHEDULER]
})
export class BucketHooksModule {}
