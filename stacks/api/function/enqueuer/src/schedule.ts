import {EventQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";
import {ClassCommander, JobReducer} from "@spica-server/replication";
import * as cron from "cron";
import {Description, Enqueuer} from "./enqueuer";

interface ScheduleOptions {
  frequency: string;
  timezone: string;
}

export class ScheduleEnqueuer implements Enqueuer<ScheduleOptions> {
  type = event.Type.SCHEDULE;

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
    private jobReducer?: JobReducer,
    private commander?: ClassCommander
  ) {
    if (this.commander) {
      this.commander.register(this, [this.shift]);
    }
  }

  subscribe(target: event.Target, options: ScheduleOptions): void {
    const job = new cron.CronJob({
      cronTime: options.frequency,
      onTick: () => this.onTickHandler(target, options),
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

  onTickHandler(target: event.Target, options: ScheduleOptions) {
    const now = new Date(new Date().setMilliseconds(0)).getTime();

    const ev = new event.Event({
      target,
      type: event.Type.SCHEDULE
    });
    const onTick = () => {
      this.queue.enqueue(ev);
    };

    const meta = {
      _id: `${target.cwd}-${target.handler}-${options.frequency}-${options.timezone}-${now}`,
      cwd: target.cwd,
      handler: target.handler,
      frequency: options.frequency,
      timezone: options.timezone,
      event_id: ev.id
    };

    if (this.jobReducer) {
      this.jobReducer.do(meta, onTick);
    } else {
      onTick();
    }
  }

  onEventsAreDrained(events: event.Event[]): Promise<any> {
    if (!this.jobReducer) {
      return;
    }

    const shiftPromises: Promise<any>[] = [];

    for (const event of events) {
      const shift = this.jobReducer.find({event_id: event.id}).then(([job]) => {
        if (!job) {
          console.error(`Job with event id ${event.id} does not exist!`);
          return;
        }

        return this.shift(event.target, {frequency: job.frequency, timezone: job.timezone});
      });

      shiftPromises.push(shift);
    }

    return Promise.all(shiftPromises);
  }

  shift(target: event.Target, options: ScheduleOptions) {
    return this.onTickHandler(target, options);
  }
}
