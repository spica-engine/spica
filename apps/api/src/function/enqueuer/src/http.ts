import {Middlewares} from "../../../../../../libs/core";
import {EventQueue, HttpQueue} from "../../queue";
import {event, Http} from "../../queue/proto";
import {Enqueuer} from "./enqueuer";
import express from "express";
import bodyParser from "body-parser";
import {CorsOptions} from "../../../../../../libs/interface/core";
import {AttachStatusTracker} from "../../../../../../libs/interface/status";
import {Description, HttpMethod, HttpOptions} from "../../../../../../libs/interface/function/enqueuer";

export class HttpEnqueuer extends Enqueuer<HttpOptions> {
  type = event.Type.HTTP;

  description: Description = {
    icon: "http",
    name: "http",
    title: "Http",
    description: "Designed for APIs and Http Streaming"
  };

  private router = express.Router({mergeParams: true});

  constructor(
    private queue: EventQueue,
    private http: HttpQueue,
    httpServer: express.Application,
    private corsOptions: CorsOptions,
    private schedulerUnsubscription: (targetId: string) => void,
    private attachStatusTracker?: AttachStatusTracker
  ) {
    super();
    this.router.use(
      bodyParser.raw({
        limit: "10mb",
        type: "*/*"
      }) as any
    );
    this.router.use(this.handleUnhandled);
    const stack = httpServer._router.stack;
    httpServer.use("/fn-execute", this.router);
    const expressInitIndex = stack.findIndex(l => l.name === "expressInit");
    const layer = stack.splice(stack.length - 1, 1)[0];
    stack.splice(expressInitIndex + 1, 0, layer);
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
    this.router.stack.splice(
      this.router.stack.findIndex(l => l.handle == this.handleUnhandled),
      1
    );
    this.router.use(this.handleUnhandled);
  }

  subscribe(target: event.Target, options: HttpOptions): void {
    const method = options.method.toLowerCase();
    const path = options.path.replace(/^\/?(.*?)\/?$/, "/$1");

    if (options.preflight && options.method != HttpMethod.Head) {
      if (options.method == HttpMethod.Options) {
        throw new Error("Preflight option was used with HttpMethod.Options");
      }

      const fn = (req, res, next) => Middlewares.Preflight(this.corsOptions)(req, res, next);

      Object.defineProperty(fn, "target", {writable: false, value: target});

      this.router.options(path, fn);
      this.router[method](path, fn);
    }

    const fn = (req: express.Request, res: express.Response) => {
      const ev = new event.Event({
        target,
        type: event.Type.HTTP
      });
      this.queue.enqueue(ev);
      const request = new Http.Request({
        method: req.method,
        url: req.url,
        path: req.path,
        statusCode: req.statusCode,
        statusMessage: req.statusMessage,
        query: JSON.stringify(req.query),
        body: new Uint8Array(req.body)
      });
      request.params = Object.keys(req.params).reduce((acc, key) => {
        const param = new Http.Param();
        param.key = key;
        param.value = req.params[key] as string;
        acc.push(param);
        return acc;
      }, []);
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

      if (this.attachStatusTracker) {
        this.attachStatusTracker(req, res);
      }

      this.http.enqueue(ev.id, request, res as any);

      // https://github.com/nodejs/node/commit/0c545f0f72
      // Due to changes above on nodejs v14, we can not listen request 'close' anymore because it will be invoked after request 'end' as well.
      // After request body is read succesfully, request 'end' will be invoked for example.
      // But actual 'close' we want to listen is for request cancellations, aborts etc. So we should listen connection 'close' instead.
      req.connection.once("close", () => {
        if (!req.res.headersSent) {
          this.queue.dequeue(ev);
          this.http.dequeue(ev.id);
        }
      });
    };

    Object.defineProperty(fn, "target", {writable: false, value: target});

    this.router[method](path, fn);

    this.reorderUnhandledHandle();
  }

  unsubscribe(target: event.Target): void {
    this.schedulerUnsubscription(target.id);

    this.router.stack = this.router.stack.filter(layer => {
      if (layer.route) {
        return !layer.route.stack.some(layer => {
          if (!target.handler) {
            return layer.handle["target"].cwd == target.cwd;
          } else {
            return (
              layer.handle["target"].cwd == target.cwd &&
              layer.handle["target"].handler == target.handler
            );
          }
        });
      }
      return true;
    });
    this.reorderUnhandledHandle();
  }

  onEventsAreDrained(events: event.Event[]): Promise<any> {
    for (const event of events) {
      const {response} = this.http.get(event.id);
      response.status(503).send();
    }

    return Promise.resolve();
  }
}
