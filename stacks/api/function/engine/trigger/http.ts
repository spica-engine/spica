import {Logger, Module} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import {Middlewares} from "@spica-server/core";
import {Info, InvokerFn, Target, Trigger, TriggerFlags, TriggerSchema} from "./base";
import express = require("express");
import bodyParser = require("body-parser");

enum HttpMethod {
  All = "All",
  Get = "Get",
  Post = "Post",
  Put = "Put",
  Delete = "Delete",
  Options = "Options",
  Patch = "Patch",
  Head = "Head"
}

interface HttpTriggerOptions {
  method: HttpMethod;
  path: string;
  preflight: boolean;
}

@Trigger({
  name: "http",
  flags: TriggerFlags.NotSubscribable
})
export class HttpTrigger implements Trigger<HttpTriggerOptions> {
  private logger = new Logger(HttpTrigger.name);

  private router = express.Router({mergeParams: true});

  constructor(http: HttpAdapterHost) {
    this.router.use(bodyParser.json(), Middlewares.BsonBodyParser);
    http.httpAdapter.use("/fn-execute", this.router);
    http.httpAdapter.use("/fn-execute/*", (req, res) => {
      if (!req.route) {
        res.status(404).send({
          message: "Invalid route",
          engine: "Function"
        });
      }
    });
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
    const req = {};
    const res = {
      send: body => {
        info(body);
        return res;
      }
    };
    return Promise.resolve([req, res]);
  }

  register(invoker: InvokerFn, target: Target, options: HttpTriggerOptions) {
    const method = options.method.toLowerCase();
    const path = options.path.startsWith("/") ? options.path : `/${options.path}`;

    if (invoker) {
      if (options.preflight) {
        this.router[method](path, Middlewares.Preflight, (...parameters) =>
          invoker({target, parameters})
        );
      } else {
        this.router[method](path, (...parameters) => invoker({target, parameters}));
      }
      this.logger.verbose(
        `Registered ${target.id}.${target.handler} to {/fn-execute${path}, ${options.method}}`
      );
    } else {
      const index = this.router.stack.findIndex(layer => layer.route && layer.route.path == path);
      if (index != -1) {
        this.router.stack.splice(index, 1);
        this.logger.verbose(
          `Deregistered ${target.id}.${target.handler} to {/fn-execute${path}, ${options.method}}`
        );
      }
    }
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
