import {EventQueue, HttpQueue} from "@spica-server/function/queue";
import {Event, Http} from "@spica-server/function/queue/proto";
import {Description, Enqueuer} from "./enqueuer";

export class HttpEnqueuer extends Enqueuer<HttpOptions> {
  description: Description = {
    icon: "http",
    name: "http",
    title: "Http",
    description: "Designed for APIs and Http Streaming"
  };

  constructor(private queue: EventQueue, private http: HttpQueue) {
    super();
  }

  subscribe(target: Event.Target, options: HttpOptions): void {
    (() => {
      const event = new Event.Event();
      event.target = target;
      const request = new Http.Request();

      this.queue.enqueue(event);
      this.http.enqueue(request);
    })();
  }

  unsubscribe(target: Event.Target): void {
    throw new Error("Method not implemented.");
  }
}

export enum HttpMethod {
  All = 1,
  Get = 2,
  Post = 3,
  Put = 4,
  Delete = 5,
  Options = 6,
  Patch = 7,
  Head = 8
}

export interface HttpOptions {
  method: HttpMethod;
  path: string;
  preflight: boolean;
}
