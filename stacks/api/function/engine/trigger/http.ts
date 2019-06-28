import {Logger, Module} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import {InvokerFn, RunSchema, Target, Trigger, TriggerFlags, TriggerSchema} from "./base";
import express = require("express");

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
}

@Trigger({
  name: "http",
  flags: TriggerFlags.NotSubscribable
})
export class HttpTrigger implements Trigger<HttpTriggerOptions> {
  private logger = new Logger(HttpTrigger.name);

  private router = express.Router({mergeParams: true});

  constructor(http: HttpAdapterHost) {
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
      $id: "functions:triggers/http",
      title: "Http",
      description: "An http trigger for functions",
      type: "object",
      required: ["path", "method"],
      properties: {
        method: {
          title: "Method",
          description: "Http trigger would rely on request method.",
          type: "string",
          enum: ["All", "Get", "Post", "Put", "Delete", "Options", "Patch", "Head"]
        },
        path: {
          title: "Path",
          description: "Full route path that function will be served on. eg /books",
          type: "string"
        }
      },
      additionalProperties: false
    };
    return Promise.resolve(schema);
  }

  runSchema(options: HttpTriggerOptions): Promise<RunSchema> {
    const schema: RunSchema = {
      $id: "functions:triggers/http",
      title: "Run http",
      type: "object"
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
      this.router[method](path, (...parameters) => invoker({target, parameters}));
      this.logger.verbose(
        `Registered ${target.id}.${target.handler} to {/fn-execute${path}, ${options.method}}`
      );
    } else {
      const index = this.router.stack.findIndex(layer => layer.route && layer.route.path == path);
      if (index) {
        this.router.stack.splice(index, 1);
        this.logger.verbose(
          `Deregistered ${target.id}.${target.handler} to {/fn-execute${path}, ${options.method}}`
        );
      }
    }
  }

  declarations(): Promise<string> {
    return Promise.resolve(`
			export namespace Http {
				export interface Request {

				}
				export interface Response {

				}
			}`);
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
