import {EventQueue} from "@spica-server/function-queue";
import {event} from "@spica-server/function-queue-proto";
import {ClassCommander, JobReducer} from "@spica-server/replication";
import {CommandType} from "@spica-server/interface-replication";
import schedule from "node-schedule";
import {Enqueuer} from "./enqueuer.js";
import uniqid from "uniqid";
import {Description, ScheduleOptions} from "@spica-server/interface-function-enqueuer";
import {Logger} from "@nestjs/common";

export class ScheduleEnqueuer implements Enqueuer<ScheduleOptions> {
  type = event.Type.SCHEDULE;
  private readonly logger = new Logger(ScheduleEnqueuer.name);

  private jobs = new Set<schedule.Job>();

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
      this.commander = this.commander.new();
      this.commander.register(this, [this.shift], CommandType.SHIFT);
    }
  }

  subscribe(target: event.Target, options: ScheduleOptions): void {
    const job = schedule.scheduleJob(
      {rule: options.frequency, tz: options.timezone},
      (fireDate: Date) => {
        this.onTickHandler(target, options, fireDate.getTime());
      }
    );

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
        job.cancel();
        this.jobs.delete(job);
      }
    }
  }

  onTickHandler(target: event.Target, options: ScheduleOptions, firedAt: number, eventId?: string) {
    const ev = new event.Event({
      id: eventId || uniqid(),
      target,
      type: event.Type.SCHEDULE
    });

    const enqueue = () => {
      this.queue.enqueue(ev);
    };

    const meta = {
      _id: `${target.cwd}-${target.handler}-${options.frequency}-${options.timezone}-${firedAt}`,
      cwd: target.cwd,
      handler: target.handler,
      frequency: options.frequency,
      timezone: options.timezone,
      event_id: ev.id
    };

    if (this.jobReducer) {
      this.jobReducer.do(meta, enqueue);
    } else {
      enqueue();
    }
  }

  onEventsAreDrained(events: event.Event[]): Promise<any> {
    if (!this.jobReducer) {
      return;
    }

    const shiftPromises: Promise<any>[] = [];
    for (const event of events) {
      const shift = this.jobReducer.findOneAndDelete({event_id: event.id}).then(job => {
        if (!job) {
          this.logger.error(`Job with event id ${event.id} does not exist!`);
          return;
        }
        return this.shift(
          event.target.toObject(),
          {
            frequency: job.frequency,
            timezone: job.timezone
          },
          event.id
        );
      });

      shiftPromises.push(shift);
    }

    return Promise.all(shiftPromises);
  }

  shift(
    target: {
      id: string;
      cwd: string;
      handler: string;
      context: {
        env: {
          key: string;
          value: string;
        }[];
        timeout: number;
      };
    },
    options: ScheduleOptions,
    eventId: string
  ) {
    const newTarget = new event.Target({
      id: target.id,
      cwd: target.cwd,
      handler: target.handler,
      context: new event.SchedulingContext({
        env: Object.keys(target.context.env).reduce((envs, key) => {
          envs.push(
            new event.SchedulingContext.Env({
              key,
              value: target.context.env[key]
            })
          );
          return envs;
        }, []),
        timeout: target.context.timeout
      })
    });
    const now = new Date(new Date().setMilliseconds(0)).getTime();
    return this.onTickHandler(newTarget, options, now, eventId);
  }
}
