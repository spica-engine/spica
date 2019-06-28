import {Module} from "@nestjs/common";
import * as cron from "cron";
import {InvokerFn, Target, Trigger, TriggerFlags, TriggerSchema} from "./base";

interface SchedulingOptions {
  frequency: string;
  timezone: string;
}

@Trigger({
  name: "schedule",
  flags: TriggerFlags.NotSubscribable
})
export class ScheduleTrigger implements Trigger<SchedulingOptions> {
  private jobs = new Map<string, cron.CronJob>();

  register(invoker: InvokerFn, target: Target, options: SchedulingOptions) {
    const targetKey = `${target.id}_${target.handler}`;
    if (invoker) {
      const job = new cron.CronJob(
        options.frequency,
        () => invoker({target, parameters: [job.stop]}),
        () => this.jobs.delete(targetKey),
        true,
        "Europe/Istanbul"
      );
      this.jobs.set(targetKey, job);
      job.start();
    } else {
      const job = this.jobs.get(targetKey);
      if (job) {
        job.stop();
        this.jobs.delete(targetKey);
      }
    }
  }
  schema(): Promise<TriggerSchema> {
    const schema: TriggerSchema = {
      $id: "functions:triggers/schedule",
      title: "Scheduled",
      description: "An scheduled trigger for functions",
      type: "object",
      properties: {
        frequency: {
          title: "Frequency",
          description:
            "Schedules are specified using unix-cron format, e.g. every minute: '* * * * *', every 3 hours: '0 */3 * * *', every Monday at 9:00: '0 9 * * 1'.",
          type: "string",
          pattern: "(28|*) +[2*] +[7*] +[1*] +[1*]"
        },
        timezone: {
          title: "Timezone",
          enum: []
        }
      },
      additionalProperties: false
    };
    return Promise.resolve(schema);
  }
  declarations(): Promise<string> {
    return Promise.resolve("");
  }
}

@Module({
  providers: [
    {
      provide: ScheduleTrigger,
      useClass: ScheduleTrigger
    }
  ]
})
export class ScheduleTriggerModule {}
