import {EventQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";
import {JobReducer} from "@spica-server/replication";
import * as cron from "cron";
import {Description, Enqueuer} from "./enqueuer";

interface ScheduleOptions {
  frequency: string;
  timezone: string;
}

export class ScheduleEnqueuer implements Enqueuer<ScheduleOptions> {
  private jobs = new Set<cron.CronJob>();

  description: Description = {
    icon: "schedule",
    name: "schedule",
    title: "Scheduler",
    description: "Designed for scheduled tasks and jobs."
  };

  constructor(
    private queue: EventQueue,
    private schedulerUnsubscription: (targetId: string) => void,
    private jobReducer?: JobReducer
  ) {}

  subscribe(target: event.Target, options: ScheduleOptions): void {
    const onTickHandler = () => {
      const now = new Date(new Date().setMilliseconds(0)).getTime();

      const onTick = () => {
        const ev = new event.Event({
          target,
          type: event.Type.SCHEDULE
        });
        this.queue.enqueue(ev);
      };

      const meta = {
        _id: `${target.cwd}-${target.handler}-${options.frequency}-${options.timezone}-${now}`,
        cwd: target.cwd,
        handler: target.handler,
        frequency: options.frequency,
        timezone: options.timezone
      };

      if (this.jobReducer) {
        this.jobReducer.do(meta, onTick);
      }
    };

    const job = new cron.CronJob({
      cronTime: options.frequency,
      onTick: onTickHandler,
      start: true,
      timeZone: options.timezone
    });

    Object.defineProperty(job, "target", {writable: false, value: target});
    this.jobs.add(job);
  }

  unsubscribe(target: event.Target): void {
    this.schedulerUnsubscription(target.id);

    for (const job of this.jobs) {
      if (
        (!target.handler && job["target"].cwd == target.cwd) ||
        (target.handler &&
          job["target"].cwd == target.cwd &&
          job["target"].handler == target.handler)
      ) {
        job.stop();
        this.jobs.delete(job);
      }
    }
  }
}
