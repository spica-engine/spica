import {EventQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";
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

  constructor(private queue: EventQueue) {}

  subscribe(target: Event.Target, options: ScheduleOptions): void {
    const job = new cron.CronJob({
      cronTime: options.frequency,
      onTick: () => {
        const event = new Event.Event();
        event.target = target;
        event.type = Event.Type.SCHEDULE;
        this.queue.enqueue(event);
      },
      start: true,
      timeZone: options.timezone
    });
    Object.defineProperty(job, "target", {writable: false, value: target});
    this.jobs.add(job);
  }

  unsubscribe(target: Event.Target): void {
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
