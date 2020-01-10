import {Injectable, OnModuleInit} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import {DatabaseService} from "@spica-server/database";
import {DatabaseEnqueuer, Enqueuer, HttpEnqueuer} from "@spica-server/function/enqueuer";
import {DatabaseQueue, EventQueue, HttpQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";
import {Runtime} from "@spica-server/function/runtime";
import {Node} from "@spica-server/function/runtime/node";

@Injectable()
export class Horizon implements OnModuleInit {
  private queue: EventQueue;
  private httpQueue: HttpQueue;
  private databaseQueue: DatabaseQueue;

  runtime: Node;

  readonly runtimes = new Set<Runtime>();
  readonly enqueuers = new Set<Enqueuer<unknown>>();

  constructor(private http: HttpAdapterHost, private database: DatabaseService) {
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
    const httpEnqueuer = new HttpEnqueuer(
      this.queue,
      this.httpQueue,
      this.http.httpAdapter.getInstance()
    );
    this.enqueuers.add(httpEnqueuer);

    const databaseEnqueuer = new DatabaseEnqueuer(this.queue, this.databaseQueue, this.database);
    this.enqueuers.add(databaseEnqueuer);
  }

  enqueue(event: Event.Event) {
    this.runtime.execute({
      eventId: event.id,
      cwd: event.target.cwd
    });
  }

  kill() {
    this.queue.kill();
  }
}
