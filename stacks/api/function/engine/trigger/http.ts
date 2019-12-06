import {Logger, Module, OnModuleInit} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import {Middlewares} from "@spica-server/core";
import {Info, InvokerFn, Target, Trigger, TriggerFlags, TriggerSchema} from "./base";
import express = require("express");
import bodyParser = require("body-parser");

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

export interface HttpTriggerOptions {
  method: HttpMethod;
  path: string;
  preflight: boolean;
}

@Trigger({
  name: "http",
  flags: TriggerFlags.NotSubscribable
})
export class HttpTrigger implements Trigger<HttpTriggerOptions>, OnModuleInit {
  private logger = new Logger(HttpTrigger.name);
  private router = express.Router({mergeParams: true});

  constructor(private http: HttpAdapterHost) {
    this.router.use(bodyParser.json(), Middlewares.BsonBodyParser, this.handleUnhandled);
  }

  onModuleInit() {
    this.http.httpAdapter.use("/fn-execute", this.router);
  }

  private handleUnhandled(req, res) {
    // By default express sends a default response if the OPTIONS route is unhandled
    // https://github.com/expressjs/express/blob/3ed5090ca91f6a387e66370d57ead94d886275e1/lib/router/index.js#L640
    if (!req.route) {
      res.status(404).send({
        message: "Invalid route",
        engine: "Function"
      });
    }
  }

  private reorderUnhandledHandle() {
    this.router.stack.splice(this.router.stack.findIndex(l => l.handle == this.handleUnhandled), 1);
    this.router.use(this.handleUnhandled);
  }

  register(invoker: InvokerFn, target: Target, options: HttpTriggerOptions) {
    const method = options.method.toLowerCase();
    const path = options.path.replace(/^\/?(.*?)\/?$/, "/$1");

    if (invoker) {
      if (
        options.preflight &&
        options.method != HttpMethod.Get &&
        options.method != HttpMethod.Head
      ) {
        this.router.options(path, Middlewares.Preflight);
        this.logger.verbose(
          `Registered ${target.id}.${target.handler} to {/fn-execute${path}, Options}`
        );
      }

      this.router[method](path, async (req, res) => {
        try {
          const result = await invoker({target, parameters: [req, res]});
          if (!res.headersSent) {
            res.send(result);
          }
        } catch (e) {
          if (!res.headersSent) {
            res.status(500).send(e);
          }
        }
      });
      this.logger.verbose(
        `Registered ${target.id}.${target.handler} to {/fn-execute${path}, ${options.method}}`
      );
    } else {
      this.router.stack = this.router.stack.filter((layer, index) => {
        if (layer.route) {
          this.logger.verbose(
            `Deregistered ${target.id}.${target.handler} to {/fn-execute${path}, ${
              options.preflight && layer.route.methods.options ? "Options" : options.method
            }}`
          );
          // prettier-ignore
          return !(
            layer.route.path == path &&
            (
              layer.route.methods[options.method.toLowerCase()] ||
              (
                options.method != HttpMethod.Get &&
                options.method != HttpMethod.Head &&
                layer.route.methods.options &&
                this.router.stack.findIndex( layer => layer.route && layer.route.path == path && layer.route.methods.options ) == index
              )
            )
          );
        }
        return true;
      });
    }
    this.reorderUnhandledHandle();
  }

  schema(): Promise<TriggerSchema> {
    const schema: TriggerSchema = {
      $id: "http://spica.internal/function/triggers/http/schema",
      title: "Http",
      description: "An http trigger for functions",
      type: "object",
      required: ["path", "method"],
      properties: {
        method: {
          title: "Method",
          description: "Http trigger would rely on request method.",
          type: "string",
          enum: ["All", "Get", "Post", "Put", "Delete", "Patch", "Head"]
        },
        path: {
          title: "Path",
          description: "Full route path that function will be served on. eg /books",
          type: "string"
        },
        preflight: {
          title: "Preflight",
          description: "Whether preflight requests should be handled.",
          type: "boolean",
          default: true
        }
      },
      additionalProperties: false
    };
    return Promise.resolve(schema);
  }

  stub(test: any, info: Function) {
    const req = {query: {}, body: {}, params: {}};
    const res = {
      header: (name: string, value: string) => {
        info("Header ", `${name}: ${value}`);
        return res;
      },
      status: (code: number) => {
        info("Status code: ", code);
        return res;
      },
      send: (body: any) => {
        info("Body: ", body);
        return res;
      }
    };
    return Promise.resolve([req, res]);
  }

  info(options: HttpTriggerOptions) {
    const info: Info = {
      icon: "http",
      text: `${options.method} ${options.path}`,
      url: `${process.env.PUBLIC_HOST}/fn-execute/${options.path.replace(/^\//, "")}`,
      type: "url"
    };
    return Promise.resolve([info]);
  }
}

@Module({
  providers: [
    {
      provide: HttpTrigger,
      useClass: HttpTrigger,
      inject: [HttpAdapterHost]
    }
  ],
  exports: [HttpTrigger]
})
export class HttpTriggerModule {}
