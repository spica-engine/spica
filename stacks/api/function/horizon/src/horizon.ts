import {Injectable} from "@nestjs/common";
import {EventQueue, HttpQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";
import {Node} from "@spica-server/function/runtime/node";

@Injectable()
export class Horizon {
  private queue: EventQueue;
  private httpQueue: HttpQueue;
  private runtime: Node;

  constructor() {
    this.queue = new EventQueue(this.enqueue);
    this.httpQueue = new HttpQueue();
    this.runtime = new Node();
    this.queue.addQueue(this.httpQueue);
  }

  enqueue(event: Event.Event) {    
    this.runtime.execute({
      handler: event.target.handler,
      cwd: event.target.cwd
    });
  }

  kill() {
    this.queue.kill();
  }
}
