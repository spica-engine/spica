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
import {Event} from "@spica-server/function/queue/proto";
import {Runtime, Worker} from "@spica-server/function/runtime";
import {DatabaseOutput, StandartStream} from "@spica-server/function/runtime/io";
import {Node} from "@spica-server/function/runtime/node";
import * as uniqid from "uniqid";
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

  private readonly pool = new Map<string, Worker>();

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

    this.queue = new EventQueue(this.schedule.bind(this), this.yield.bind(this));

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
      this.schedule();
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

  private schedule() {
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
    this.pool.set(id, worker);
    // Do not enable autospawn under testing
    if (!process.env.TEST_TARGET) {
      worker.once("exit", () => {
        this.pool.delete(id);
        this.schedule();
      });
    }
  }

  private yield(event: Event.Event, workerId: string) {
    const worker = this.pool.get(workerId);
    const [stdout, stderr] = this.output.create({
      eventId: event.id,
      functionId: event.target.id
    });
    const timeoutInSeconds = Math.min(this.options.timeout, event.target.context.timeout);
    const timeout = setTimeout(() => {
      stderr.write(
        `Function (${event.target.handler}) did not finish within ${timeoutInSeconds} seconds. Aborting.`
      );
      worker.kill();
    }, timeoutInSeconds * 1000);
    worker.attach(stdout, stderr);
    worker.once("exit", () => clearTimeout(timeout));
  }

  /**
   * ATTENTION: Do not use this method since it is only designed for testing.
   */
  kill() {
    this.queue.kill();
  }
}
