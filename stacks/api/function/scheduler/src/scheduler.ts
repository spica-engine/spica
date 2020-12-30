import {Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import {DatabaseService} from "@spica-server/database";
import {
  DatabaseEnqueuer,
  Enqueuer,
  FirehoseEnqueuer,
  HttpEnqueuer,
  ScheduleEnqueuer,
  SystemEnqueuer
} from "@spica-server/function/enqueuer";
import {DatabaseQueue, EventQueue, FirehoseQueue, HttpQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";
import {discovery, spawn, Worker} from "@spica-server/function/runtime";
import {DatabaseOutput, StandartStream} from "@spica-server/function/runtime/io";
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

  readonly enqueuers = new Set<Enqueuer<unknown>>();

  private output: StandartStream;

  constructor(
    private http: HttpAdapterHost,
    private database: DatabaseService,
    @Inject(SCHEDULING_OPTIONS) private options: SchedulingOptions,
    @Optional() @Inject(ENQUEUER) private enqueuerFactory: EnqueuerFactory<unknown, unknown>
  ) {
    discovery.root = options.runtime.discoveryRoot;

    this.output = new DatabaseOutput(database);

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
      await this.spawn();
    }
  }

  async onModuleDestroy() {
    for (const [id, worker] of this.pool.entries()) {
      await worker.kill();
      this.pool.delete(id);
    }
    return this.queue.kill();
  }

  private readonly pool = new Map<string, Worker>();

  workers = new Map<string, (event: event.Event) => void>();

  eventQueue = new Map<string, event.Event>();
  processsingQueue = new Map<string, event.Event>();

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

      if (target.context.batch) {
        let batch = this.getBatchForTarget(target);
        if (!batch) {
          const worker = this.takeAWorker();

          if (!worker) {
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
          break;
        }

        schedule = worker.schedule;
        workerId = worker.workerId;
      }

      const worker = this.pool.get(workerId);
      const [stdout, stderr] = this.output.create({
        eventId: event.id,
        functionId: event.target.id
      });
      worker.attach(stdout, stderr);

      const timeoutInSeconds = Math.min(this.options.timeout, event.target.context.timeout);
      this.timeouts.set(
        event.id,
        setTimeout(() => {
          stderr.write(
            `Function (${event.target.handler}) did not finish within ${timeoutInSeconds} seconds. Aborting.`
          );

          worker.kill();
        }, timeoutInSeconds * 1000)
      );

      schedule(event);

      this.eventQueue.delete(event.id);
      this.processsingQueue.set(event.id, event);

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
    this.processsingQueue.delete(id);
    clearTimeout(this.timeouts.get(id));
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
    if (process.env.TEST_TARGET) {
      return console.log(`lost a worker ${id} and skipping auto spawn under testing`);
    }
    console.debug(`lost a worker ${id}`);
    this.pool.delete(id);
    this.workers.delete(id);
    this.batching.delete(id);
    this.spawn();
  }

  private async spawn() {
    if (this.pool.size >= this.options.poolMaxSize) {
      return;
    }
    const id: string = uniqid();
    const worker = await spawn({
      id,
      environment: {
        __INTERNAL__SPICA__MONGOURL__: this.options.databaseUri,
        __INTERNAL__SPICA__MONGODBNAME__: this.options.databaseName,
        __INTERNAL__SPICA__MONGOREPL__: this.options.databaseReplicaSet,
        __INTERNAL__SPICA__PUBLIC_URL__: this.options.apiUrl,
        __EXPERIMENTAL_DEVKIT_DATABASE_CACHE: this.options.experimentalDevkitDatabaseCache
          ? "true"
          : ""
      },
      runtime: {
        name: this.options.runtime.default.name,
        version: this.options.runtime.default.version
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
