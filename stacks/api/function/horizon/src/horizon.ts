import {Injectable, OnModuleInit} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import {DatabaseService} from "@spica-server/database";
import {
  DatabaseEnqueuer,
  Enqueuer,
  HttpEnqueuer,
  ScheduleEnqueuer
} from "@spica-server/function/enqueuer";
import {DatabaseQueue, EventQueue, HttpQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";
import {Runtime} from "@spica-server/function/runtime";
import {DatabaseOutput, StdOut} from "@spica-server/function/runtime/io";
import {Node} from "@spica-server/function/runtime/node";

@Injectable()
export class Horizon implements OnModuleInit {
  private queue: EventQueue;
  private httpQueue: HttpQueue;
  private databaseQueue: DatabaseQueue;

  private output: StdOut;
  runtime: Node;

  readonly runtimes = new Set<Runtime>();
  readonly enqueuers = new Set<Enqueuer<unknown>>();

  constructor(private http: HttpAdapterHost, private database: DatabaseService) {
    this.output = new DatabaseOutput(database);
    this.runtime = new Node();
    this.runtimes.add(this.runtime);

    this.queue = new EventQueue(this.enqueue.bind(this));

    this.httpQueue = new HttpQueue();
    this.queue.addQueue(this.httpQueue);

    this.databaseQueue = new DatabaseQueue();
    this.queue.addQueue(this.databaseQueue);

    this.queue.listen();
  }

  onModuleInit() {
    this.enqueuers.add(
      new HttpEnqueuer(this.queue, this.httpQueue, this.http.httpAdapter.getInstance())
    );

    this.enqueuers.add(new DatabaseEnqueuer(this.queue, this.databaseQueue, this.database));

    this.enqueuers.add(new ScheduleEnqueuer(this.queue));
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
