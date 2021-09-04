import {Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import {DatabaseService} from "@spica-server/database";
import {Language} from "@spica-server/function/compiler";
import {Javascript} from "@spica-server/function/compiler/javascript";
import {Typescript} from "@spica-server/function/compiler/typescript";
import {
  DatabaseEnqueuer,
  Enqueuer,
  FirehoseEnqueuer,
  HttpEnqueuer,
  ScheduleEnqueuer,
  SystemEnqueuer
} from "@spica-server/function/enqueuer";
import {PackageManager} from "@spica-server/function/pkgmanager";
import {Npm} from "@spica-server/function/pkgmanager/node";
import {DatabaseQueue, EventQueue, FirehoseQueue, HttpQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";
import {Runtime, Worker} from "@spica-server/function/runtime";
import {DatabaseOutput, StandartStream} from "@spica-server/function/runtime/io";
import {Node} from "@spica-server/function/runtime/node";
import * as uniqid from "uniqid";
import {ENQUEUER, EnqueuerFactory} from "./enqueuer";
import {SchedulingOptions, SCHEDULING_OPTIONS} from "./options";

type ScheduleWorker = Worker & {target: event.Target; schedule: (event: event.Event) => void};

@Injectable()
export class Scheduler implements OnModuleInit, OnModuleDestroy {
  private queue: EventQueue;
  private httpQueue: HttpQueue;
  private databaseQueue: DatabaseQueue;
  private firehoseQueue: FirehoseQueue;

  readonly runtimes = new Map<string, Runtime>();
  readonly pkgmanagers = new Map<string, PackageManager>();
  readonly enqueuers = new Set<Enqueuer<unknown>>();
  readonly languages = new Map<string, Language>();

  private output: StandartStream;

  constructor(
    private http: HttpAdapterHost,
    private database: DatabaseService,
    @Inject(SCHEDULING_OPTIONS) private options: SchedulingOptions,
    @Optional() @Inject(ENQUEUER) private enqueuerFactory: EnqueuerFactory<unknown, unknown>
  ) {
    this.output = new DatabaseOutput(database);

    this.languages.set("typescript", new Typescript());
    this.languages.set("javascript", new Javascript());
    this.runtimes.set("node", new Node());
    this.pkgmanagers.set("node", new Npm());

    this.queue = new EventQueue(
      (id, schedule) => this.gotWorker(id, schedule),
      event => this.enqueue(event),
      id => this.cancel(id),
      (id, succedded) => this.complete(id, succedded)
    );

    this.httpQueue = new HttpQueue();
    this.queue.addQueue(this.httpQueue);

    this.databaseQueue = new DatabaseQueue();
    this.queue.addQueue(this.databaseQueue);

    this.firehoseQueue = new FirehoseQueue();
    this.queue.addQueue(this.firehoseQueue);
  }

  async onModuleInit() {
    const schedulerUnsubscription = (targetId: string) => {
      Array.from(this.workers.entries())
        .filter(([id, worker]) => worker.target && worker.target.id == targetId)
        .forEach(([id]) => this.workers.delete(id));
    };

    this.enqueuers.add(
      new HttpEnqueuer(
        this.queue,
        this.httpQueue,
        this.http.httpAdapter.getInstance(),
        this.options.corsOptions,
        schedulerUnsubscription
      )
    );

    this.enqueuers.add(
      new FirehoseEnqueuer(
        this.queue,
        this.firehoseQueue,
        this.http.httpAdapter.getHttpServer(),
        schedulerUnsubscription
      )
    );

    this.enqueuers.add(
      new DatabaseEnqueuer(this.queue, this.databaseQueue, this.database, schedulerUnsubscription)
    );

    this.enqueuers.add(new ScheduleEnqueuer(this.queue, schedulerUnsubscription));

    this.enqueuers.add(new SystemEnqueuer(this.queue));

    if (typeof this.enqueuerFactory == "function") {
      const factory = this.enqueuerFactory(this.queue);
      this.queue.addQueue(factory.queue);
      this.enqueuers.add(factory.enqueuer);
    }

    await this.queue.listen();

    this.scaleWorkers();
  }

  async onModuleDestroy() {
    for (const [id, worker] of this.workers.entries()) {
      await worker.kill();
      this.workers.delete(id);
    }
    for (const language of this.languages.values()) {
      await language.kill();
    }
    return this.queue.kill();
  }

  workers = new Map<string, ScheduleWorker>();

  eventQueue = new Map<string, event.Event>();

  timeouts = new Map<string, NodeJS.Timeout>();

  getStatus() {
    const workers = Array.from(this.workers.values());

    const activateds = workers.filter(w => w.target).length;
    const freshes = workers.length - activateds;

    return {
      activateds: activateds,
      freshes: freshes,
      unit: "count"
    };
  }

  takeAWorker(target: event.Target): {id: string; worker: ScheduleWorker} {
    const workers = Array.from(this.workers.entries()).map(([id, worker]) => {
      return {id, worker};
    });

    const fresh = workers.find(({worker}) => !worker.target) || {id: undefined, worker: undefined};
    const activated = workers.find(({worker}) => worker.target && worker.target.id == target.id);

    return activated || fresh;
  }

  process() {
    for (const event of this.eventQueue.values()) {
      const {id: workerId, worker} = this.takeAWorker(event.target);

      const [stdout, stderr] = this.output.create({
        eventId: event.id,
        functionId: event.target.id
      });
      if (!worker) {
        stderr.write(
          `There is no worker left for ${event.target.handler}, it has been added to the queue.`
        );
        continue;
      }

      // if worker is busy, move to the next events
      if (!worker.schedule) {
        continue;
      }

      const schedule = worker.schedule;
      worker.schedule = undefined;
      worker.target = event.target;

      worker.attach(stdout, stderr);

      const timeoutInMs = Math.min(this.options.timeout, event.target.context.timeout) * 1000;
      const timeoutFn = () => {
        if (stderr.writable) {
          stderr.write(
            `${timeoutInMs / 1000} seconds timeout value has been reached for function '${
              event.target.handler
            }'. The worker is being shut down.`
          );
        }
        worker.kill();
      };

      if (this.timeouts.has(workerId)) {
        clearTimeout(this.timeouts.get(workerId));
      }
      this.timeouts.set(workerId, setTimeout(timeoutFn, timeoutInMs));

      schedule(event);

      this.eventQueue.delete(event.id);

      console.debug(`assigning ${event.id} to ${workerId}`);

      this.scaleWorkers();
    }
  }

  enqueue(event: event.Event) {
    this.eventQueue.set(event.id, event);
    this.process();
  }

  cancel(id) {
    console.debug(`an event got cancelled ${id}`);
    this.eventQueue.delete(id);
  }
  complete(id: string, succedded: boolean) {
    console.debug(
      `an event has been completed ${id} with status ${succedded ? "success" : "fail"}`
    );
  }

  gotWorker(id: string, schedule: (event: event.Event) => void) {
    const relatedWorker = this.workers.get(id);
    // related worker is undefined for some cases??
    relatedWorker.schedule = schedule;

    console.debug(
      relatedWorker.target ? `worker ${id} is waiting for new event` : `got a new worker ${id}`
    );

    this.process();
  }

  lostWorker(id: string) {
    this.workers.delete(id);

    clearTimeout(this.timeouts.get(id));
    this.timeouts.delete(id);

    console.debug(`lost a worker ${id}`);

    if (process.env.TEST_TARGET) {
      return console.log(`skipping auto-scale under testing`);
    }

    this.scaleWorkers();
  }

  private scaleWorkers() {
    const activatedWorkers = Array.from(this.workers.values()).filter(w => w.target).length;
    const desiredWorkers = activatedWorkers + 1;

    for (let i = this.workers.size; i < desiredWorkers; i++) {
      const id: string = uniqid();
      const worker = this.runtimes.get("node").spawn({
        id,
        env: {
          __INTERNAL__SPICA__MONGOURL__: this.options.databaseUri,
          __INTERNAL__SPICA__MONGODBNAME__: this.options.databaseName,
          __INTERNAL__SPICA__MONGOREPL__: this.options.databaseReplicaSet,
          __INTERNAL__SPICA__PUBLIC_URL__: this.options.apiUrl,
          __EXPERIMENTAL_DEVKIT_DATABASE_CACHE: this.options.experimentalDevkitDatabaseCache
            ? "true"
            : ""
        }
      });

      worker.once("exit", () => this.lostWorker(id));

      (worker as ScheduleWorker).schedule = undefined;
      (worker as ScheduleWorker).target = undefined;

      this.workers.set(id, worker as ScheduleWorker);
    }

    console.log("---------------------");
    console.log("ACTIVATED : ", Array.from(this.workers.values()).filter(w => w.target).length);
    console.log("FRESH     : ", Array.from(this.workers.values()).filter(w => !w.target).length);
    console.log("---------------------");
  }

  /**
   * ATTENTION: Do not use this method since it is only designed for testing.
   */
  kill() {
    this.queue.kill();
  }
}
