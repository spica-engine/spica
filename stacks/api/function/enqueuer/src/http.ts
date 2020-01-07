import {Middlewares} from "@spica-server/core";
import {EventQueue, HttpQueue} from "@spica-server/function/queue";
import {Event, Http} from "@spica-server/function/queue/proto";
import {Description, Enqueuer} from "./enqueuer";
import express = require("express");
import read = require("body-parser/lib/read");
import bodyParser = require("body-parser");

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
    this.router.use(
      bodyParser.raw({
        limit: "10mb",
        type: "*/*"
      })
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
    this.router.stack.splice(this.router.stack.findIndex(l => l.handle == this.handleUnhandled), 1);
    this.router.use(this.handleUnhandled);
  }

  subscribe(target: Event.Target, options: HttpOptions): void {
    const method = options.method.toLowerCase();
    const path = options.path.replace(/^\/?(.*?)\/?$/, "/$1");

    if (
      options.preflight &&
      options.method != HttpMethod.Get &&
      options.method != HttpMethod.Head
    ) {
      const fn = (req, res, next) => Middlewares.Preflight(req, res, next);

      Object.defineProperty(fn, "target", {writable: false, value: target});

      this.router.options(path, fn);
    }

    if (options.method == HttpMethod.Options) {
      throw new Error("Preflight have been used with with HttpMethod.Options");
    }

    const fn = (req: express.Request, res: express.Response) => {
      const event = new Event.Event();
      event.target = target;
      event.type = Event.Type.HTTP;
      this.queue.enqueue(event);
      const request = new Http.Request();
      request.method = req.method;
      request.url = req.url;
      request.path = req.path;
      request.statusCode = req.statusCode;
      request.statusMessage = req.statusMessage;
      request.params = Object.keys(req.params).reduce((acc, key) => {
        const param = new Http.Param();
        param.key = key;
        param.value = req.params[key] as string;
        acc.push(param);
        return acc;
      }, []);
      request.body = new Uint8Array(req.body);
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
    };

    Object.defineProperty(fn, "target", {writable: false, value: target});

    this.router[method](path, fn);

    this.reorderUnhandledHandle();
  }

  unsubscribe(target: Event.Target): void {
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
