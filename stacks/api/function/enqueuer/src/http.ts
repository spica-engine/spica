import {Middlewares} from "@spica-server/core";
import {EventQueue, HttpQueue} from "@spica-server/function/queue";
import {Event, Http} from "@spica-server/function/queue/proto";
import {Description, Enqueuer} from "./enqueuer";
import express = require("express");

export class HttpEnqueuer extends Enqueuer<HttpOptions> {
  description: Description = {
    icon: "http",
    name: "http",
    title: "Http",
    description: "Designed for APIs and Http Streaming"
  };

  private router = express.Router({mergeParams: true});

  constructor(private queue: EventQueue, private http: HttpQueue, httpServer: express.Application) {
    super();
    this.router.use(this.handleUnhandled);
    httpServer.use("/fn-execute", this.router);
  }

  private handleUnhandled(req, res) {
    // By default express sends a default response if the OPTIONS route is unhandled
    // https://github.com/expressjs/express/blob/3ed5090ca91f6a387e66370d57ead94d886275e1/lib/router/index.js#L640
    if (!req.route) {
      res.status(404).send({
        message: "Invalid route",
        url: req.originalUrl,
        method: req.method,
        engine: "Function"
      });
    }
  }

  private reorderUnhandledHandle() {
    this.router.stack.splice(this.router.stack.findIndex(l => l.handle == this.handleUnhandled), 1);
    this.router.use(this.handleUnhandled);
  }

  subscribe(target: Event.Target, options: HttpOptions): void {
    const method = options.method.toLowerCase();
    const path = options.path.replace(/^\/?(.*?)\/?$/, "/$1");
    const name = `${target.cwd}_${target.handler}`;

    if (
      options.preflight &&
      options.method != HttpMethod.Get &&
      options.method != HttpMethod.Head
    ) {
      this.router.options(
        path,
        {[name]: (req, res, next) => Middlewares.Preflight(req, res, next)}[name]
      );
      console.log("OPTIONS", this.router.stack);
    }

    if (options.method == HttpMethod.Options) {
      throw new Error("Preflight have been used with with HttpMethod.Options");
    }

    this.router[method](
      path,
      {
        [name]: (req: express.Request, res: express.Response) => {
          const event = new Event.Event();
          event.target = target;
          event.type = Event.Type.HTTP;
          this.queue.enqueue(event);
          const request = new Http.Request();
          request.headers = Object.keys(req.headers).reduce((acc, key) => {
            const header = new Http.Header();
            header.key = key;
            if (typeof req.headers[key] == "string") {
              header.value = req.headers[key] as string;
            } else {
              throw new Error("Implement array headers");
            }

            acc.push(header);
            return acc;
          }, []);
          this.http.enqueue(event.id, request, res);
        }
      }[name]
    );

    console.log("OPTIONS", this.router.stack[2].route);
    this.reorderUnhandledHandle();
  }

  unsubscribe(target: Event.Target): void {
    const name = `${target.cwd}_${target.handler}`;
    this.router.stack = this.router.stack.filter((layer, index) => {
      if (layer.route) {
        this.router.stack.findIndex(layer => layer.name == name);
        console.log(layer);
        return false;
      }
      return true;
    });
  }
}

// We can't use integer enum because we show these values on the UI.
export enum HttpMethod {
  All = "All",
  Get = "Get",
  Post = "Post",
  Put = "Put",
  Delete = "Delete",
  Options = "Options",
  Patch = "Patch",
  Head = "Head"
}

export interface HttpOptions {
  method: HttpMethod;
  path: string;
  preflight: boolean;
}
