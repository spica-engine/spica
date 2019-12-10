import {Injectable, OnModuleInit} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import {Enqueuer, HttpEnqueuer} from "@spica-server/function/enqueuer";
import {EventQueue, HttpQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";
import {Node} from "@spica-server/function/runtime/node";

@Injectable()
export class Horizon implements OnModuleInit {
  private queue: EventQueue;
  private httpQueue: HttpQueue;
  private runtime: Node;

  readonly enqueuers = new Set<Enqueuer<unknown>>();

  constructor(private http: HttpAdapterHost) {
    this.queue = new EventQueue(this.enqueue);
    this.httpQueue = new HttpQueue();
    this.queue.addQueue(this.httpQueue);
    this.queue.listen();
  }

  onModuleInit() {
    const httpEnqueuer = new HttpEnqueuer(
      this.queue,
      this.httpQueue,
      this.http.httpAdapter.getInstance()
    );
    this.enqueuers.add(httpEnqueuer);
  }

  enqueue(event: Event.Event) {
    this.runtime = new Node();
    this.runtime.execute({
      eventId: event.id,
      cwd: event.target.cwd
    });
  }

  kill() {
    this.queue.kill();
  }
}
