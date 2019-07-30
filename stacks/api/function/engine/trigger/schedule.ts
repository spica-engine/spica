import {Module} from "@nestjs/common";
import * as cron from "cron";
import * as moment from "moment-timezone";
import * as cronstrue from "cronstrue";
import {Info, InvokerFn, Target, Trigger, TriggerFlags, TriggerSchema} from "./base";

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
        options.timezone
      );
      this.jobs.set(targetKey, job);
    } else {
      const job = this.jobs.get(targetKey);
      if (job) {
        job.stop();
        this.jobs.delete(targetKey);
      }
    }
  }

  stub(test: any, info: Function) {
    return Promise.resolve([() => info("ScheduleTrigger: Stopped.")]);
  }

  schema(): Promise<TriggerSchema> {
    const schema: TriggerSchema = {
      $id: "http://spica.internal/function/triggers/schedule/schema",
      title: "Scheduled",
      description: "An scheduled trigger for functions",
      type: "object",
      required: ["frequency", "timezone"],
      properties: {
        frequency: {
          type: "string",
          pattern:
            "^(\\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\\*\\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\\*|([0-9]|1[0-9]|2[0-3])|\\*\\/([0-9]|1[0-9]|2[0-3])) (\\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\\*\\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\\*|([1-9]|1[0-2])|\\*\\/([1-9]|1[0-2])) (\\*|([0-6])|\\*\\/([0-6]))$",
          title: "Frequency",
          description: "Schedules are specified using unix-cron format.",
          examples: ["* * * * *", "0 */3 * * *", "0 9 * * 1"]
        },
        timezone: {
          type: "string",
          title: "Timezone",
          enum: moment.tz.names(),
          default: "Europe/Istanbul"
        }
      },
      additionalProperties: false
    };
    return Promise.resolve(schema);
  }

  info(options: SchedulingOptions) {
    const info: Info = {
      icon: "schedule",
      text: `${cronstrue.toString(options.frequency, {throwExceptionOnParseError: false})} at ${
        options.timezone
      } timezone.`,
      type: "label"
    };
    return Promise.resolve([info]);
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
