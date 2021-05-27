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
import {Batch, createBatch, updateBatch} from "./batch";
import {ENQUEUER, EnqueuerFactory} from "./enqueuer";
import {SchedulingOptions, SCHEDULING_OPTIONS} from "./options";

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
    this.enqueuers.add(
      new HttpEnqueuer(
        this.queue,
        this.httpQueue,
        this.http.httpAdapter.getInstance(),
        this.options.corsOptions
      )
    );

    this.enqueuers.add(
      new FirehoseEnqueuer(this.queue, this.firehoseQueue, this.http.httpAdapter.getHttpServer())
    );

    this.enqueuers.add(new DatabaseEnqueuer(this.queue, this.databaseQueue, this.database));

    this.enqueuers.add(new ScheduleEnqueuer(this.queue));

    this.enqueuers.add(new SystemEnqueuer(this.queue));

    if (typeof this.enqueuerFactory == "function") {
      const factory = this.enqueuerFactory(this.queue);
      this.queue.addQueue(factory.queue);
      this.enqueuers.add(factory.enqueuer);
    }

    await this.queue.listen();

    for (let i = 0; i < this.options.poolSize; i++) {
      this.spawn();
    }
  }

  async onModuleDestroy() {
    for (const [id, worker] of this.pool.entries()) {
      await worker.kill();
      this.pool.delete(id);
    }
    for (const language of this.languages.values()) {
      await language.kill();
    }
    return this.queue.kill();
  }

  private readonly pool = new Map<string, Worker>();

  workers = new Map<string, (event: event.Event) => void>();

  eventQueue = new Map<string, event.Event>();
  processingQueue = new Map<string, event.Event>();

  batching = new Map<string, Batch>();

  timeouts = new Map<string, NodeJS.Timeout>();

  getBatchForTarget(target: event.Target) {
    for (const batch of this.batching.values()) {
      if (
        batch.target == target.id &&
        batch.remaining_enqueues[target.handler] != 0 &&
        (!batch.last_enqueued_at[target.handler] ||
          Date.now() - batch.last_enqueued_at[target.handler] <
            target.context.batch.deadline * 1000)
      ) {
        return batch;
      }
    }

    return undefined;
  }

  releaseFinishedBatches() {
    for (const [workerId, batch] of this.batching.entries()) {
      if (
        Date.now() > batch.deadline ||
        Object.values(batch.remaining_enqueues).every(n => n == 0)
      ) {
        batch.schedule(undefined);
        console.log("removing dead batch " + workerId);
      }
    }
  }

  takeAWorker() {
    const workerId: string = this.workers.keys().next().value;
    if (!workerId) {
      return undefined;
    }
    const schedule = this.workers.get(workerId);
    this.workers.delete(workerId);
    return {schedule, workerId};
  }

  process() {
    for (const event of this.eventQueue.values()) {
      const {target} = event;

      let schedule: (event: event.Event) => void;
      let workerId: string;

      const [stdout, stderr] = this.output.create({
        eventId: event.id,
        functionId: event.target.id
      });

      if (target.context.batch) {
        let batch = this.getBatchForTarget(target);
        if (!batch) {
          const worker = this.takeAWorker();

          if (!worker) {
            stderr.write(
              `There is no worker left for ${event.target.handler}, it has been added to the queue.`
            );
            break;
          }

          console.debug(`creating a new batch for ${target.id}`);

          batch = createBatch(event.target, worker.workerId, worker.schedule);
          this.batching.set(batch.workerId, batch);
        } else if (!batch.schedule) {
          break;
        }

        workerId = batch.workerId;
        schedule = batch.schedule;

        updateBatch(batch, target);

        batch.schedule = undefined;
      } else {
        const worker = this.takeAWorker();

        if (!worker) {
          stderr.write(
            `There is no worker left for (${event.target.handler}), it has been added to the queue and will be executed when a worker available.`
          );
          break;
        }

        schedule = worker.schedule;
        workerId = worker.workerId;
      }

      const worker = this.pool.get(workerId);
      worker.attach(stdout, stderr);

      const timeoutInSeconds = Math.min(this.options.timeout, event.target.context.timeout);

      if (target.context.batch && !this.timeouts.has(workerId)) {
        this.timeouts.set(
          workerId,
          setTimeout(() => {
            console.log(`worker ${workerId} is shutting down..`);
            this.batching.delete(workerId);
          }, timeoutInSeconds * 1000 - 1000)
        );
      }

      this.timeouts.set(
        event.id,
        setTimeout(() => {
          if (stderr.writable) {
            stderr.write(
              `Function (${event.target.handler}) did not finish within ${timeoutInSeconds} seconds. Aborting.`
            );
          }
          worker.kill();
        }, timeoutInSeconds * 1000)
      );

      schedule(event);

      this.eventQueue.delete(event.id);
      this.processingQueue.set(event.id, event);

      console.debug(`assigning ${event.id} to ${workerId}`);
    }
  }

  enqueue(event: event.Event) {
    this.eventQueue.set(event.id, event);
    this.process();
  }

  cancel(id) {
    console.debug(`an event got cancelled ${id}`);
    this.eventQueue.delete(id);
    this.complete(id, false);
  }

  complete(id: string, succedded: boolean) {
    console.debug(
      `an event has been completed ${id} with status ${succedded ? "success" : "fail"}`
    );
    this.processingQueue.delete(id);
    // async processes keep workers alive even it exceeds timeout
    //clearTimeout(this.timeouts.get(id));
  }

  gotWorker(id: string, schedule: (event: event.Event) => void) {
    if (this.batching.has(id)) {
      console.debug(`worker ${id} is batching`);
      const batch = this.batching.get(id);
      batch.schedule = schedule;
      this.releaseFinishedBatches();
    } else {
      this.workers.set(id, schedule);
      console.debug(`got a new worker ${id}`);
    }
    this.process();
  }

  lostWorker(id: string) {
    this.pool.delete(id);
    this.workers.delete(id);
    this.batching.delete(id);

    if (process.env.TEST_TARGET) {
      return console.log(`lost a worker ${id} and skipping auto spawn under testing`);
    }
    console.debug(`lost a worker ${id}`);
    this.spawn();
  }

  private spawn() {
    if (this.pool.size >= this.options.poolMaxSize) {
      return;
    }
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
    this.pool.set(id, worker);
  }

  /**
   * ATTENTION: Do not use this method since it is only designed for testing.
   */
  kill() {
    this.queue.kill();
  }
}
