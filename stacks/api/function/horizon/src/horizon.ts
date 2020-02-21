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
import {Runtime} from "@spica-server/function/runtime";
import {DatabaseOutput, StdOut} from "@spica-server/function/runtime/io";
import {Node} from "@spica-server/function/runtime/node";
import {SCHEDULER, Scheduler} from "./scheduler";

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

  constructor(
    private http: HttpAdapterHost,
    private database: DatabaseService,
    @Optional() @Inject(SCHEDULER) private schedulerFactory: Scheduler<unknown, unknown>
  ) {
    this.output = new DatabaseOutput(database);

    this.runtime = new Node();
    this.runtimes.add(this.runtime);

    this.pkgmanagers.set(this.runtime.description.name, new Npm());

    this.queue = new EventQueue(this.enqueue.bind(this));

    this.httpQueue = new HttpQueue();
    this.queue.addQueue(this.httpQueue);

    this.databaseQueue = new DatabaseQueue();
    this.queue.addQueue(this.databaseQueue);

    this.firehoseQueue = new FirehoseQueue();
    this.queue.addQueue(this.firehoseQueue);
  }

  onModuleInit() {
    const httpServer = this.http.httpAdapter.getInstance();

    this.enqueuers.add(new HttpEnqueuer(this.queue, this.httpQueue, httpServer));

    this.enqueuers.add(new FirehoseEnqueuer(this.queue, this.firehoseQueue, httpServer));

    this.enqueuers.add(new DatabaseEnqueuer(this.queue, this.databaseQueue, this.database));

    this.enqueuers.add(new ScheduleEnqueuer(this.queue));

    this.enqueuers.add(new SystemEnqueuer(this.queue));

    if (typeof this.schedulerFactory == "function") {
      const scheduler = this.schedulerFactory(this.queue);
      this.queue.addQueue(scheduler.queue);
      this.enqueuers.add(scheduler.enqueuer);
    }

    this.queue.listen();
  }

  private enqueue(event: Event.Event) {
    const path = event.target.cwd.split("/");
    const functionId = path[path.length - 1];
    this.runtime.execute({
      eventId: event.id,
      cwd: event.target.cwd,
      stdout: this.output.create({
        eventId: event.id,
        functionId
      })
    });
  }

  /**
   * ATTENTION: Do not use this method since it is only designed for testing.
   */
  kill() {
    this.queue.kill();
  }
}
