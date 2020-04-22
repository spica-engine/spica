import {Inject, Injectable, OnModuleInit, Optional} from "@nestjs/common";
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
import {PackageManager} from "@spica-server/function/pkgmanager";
import {Npm} from "@spica-server/function/pkgmanager/node";
import {DatabaseQueue, EventQueue, FirehoseQueue, HttpQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";
import {Runtime, Worker} from "@spica-server/function/runtime";
import {DatabaseOutput, StdOut} from "@spica-server/function/runtime/io";
import {Node} from "@spica-server/function/runtime/node";
import * as uniqid from "uniqid";
import {ENQUEUER, EnqueuerFactory} from "./enqueuer";

@Injectable()
export class Horizon implements OnModuleInit {
  private queue: EventQueue;
  private httpQueue: HttpQueue;
  private databaseQueue: DatabaseQueue;
  private firehoseQueue: FirehoseQueue;

  private output: StdOut;
  runtime: Node;

  readonly runtimes = new Set<Runtime>();
  readonly pkgmanagers = new Map<string, PackageManager>();
  readonly enqueuers = new Set<Enqueuer<unknown>>();

  private readonly pool = new Map<string, Worker>();

  constructor(
    private http: HttpAdapterHost,
    private database: DatabaseService,
    @Optional() @Inject(ENQUEUER) private enqueuerFactory: EnqueuerFactory<unknown, unknown>
  ) {
    this.output = new DatabaseOutput(database);

    this.runtime = new Node();
    this.runtimes.add(this.runtime);

    this.pkgmanagers.set(this.runtime.description.name, new Npm());

    this.queue = new EventQueue(this.schedule.bind(this), this.scheduled.bind(this));

    this.httpQueue = new HttpQueue();
    this.queue.addQueue(this.httpQueue);

    this.databaseQueue = new DatabaseQueue();
    this.queue.addQueue(this.databaseQueue);

    this.firehoseQueue = new FirehoseQueue();
    this.queue.addQueue(this.firehoseQueue);
  }

  onModuleInit() {
    this.enqueuers.add(
      new HttpEnqueuer(this.queue, this.httpQueue, this.http.httpAdapter.getInstance())
    );

    this.enqueuers.add(
      new FirehoseEnqueuer(this.queue, this.firehoseQueue, this.http.httpAdapter.getHttpServer())
    );

    this.enqueuers.add(new DatabaseEnqueuer(this.queue, this.databaseQueue, this.database));

    this.enqueuers.add(new ScheduleEnqueuer(this.queue));

    this.enqueuers.add(new SystemEnqueuer(this.queue));

    if (typeof this.enqueuerFactory == "function") {
      const scheduler = this.enqueuerFactory(this.queue);
      this.queue.addQueue(scheduler.queue);
      this.enqueuers.add(scheduler.enqueuer);
    }

    this.queue.listen();

    const poolSize = process.env.FUNCTION_POOL_SIZE ? Number(process.env.FUNCTION_POOL_SIZE) : 10;
    for (let i = 0; i < poolSize; i++) {
      this.schedule();
    }
  }

  private schedule() {
    const id = uniqid();
    const worker = this.runtime.spawn(id);
    this.pool.set(id, worker);
  }

  private scheduled(event: Event.Event, workerId: string) {
    const worker = this.pool.get(workerId);
    const path = event.target.cwd.split("/");
    const functionId = path[path.length - 1];

    const stdOut = this.output.create({
      eventId: event.id,
      functionId
    });

    // TODO: forward stderr to another channel
    worker.attach(stdOut, stdOut);

    this.pool.delete(workerId);
  }

  /**
   * ATTENTION: Do not use this method since it is only designed for testing.
   */
  kill() {
    this.queue.kill();
  }
}
