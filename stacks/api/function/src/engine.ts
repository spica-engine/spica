import {Inject, Injectable} from "@nestjs/common";
import {Horizon} from "@spica-server/function/horizon";
import {Event} from "@spica-server/function/queue/proto";
import {JSONSchema7} from "json-schema";
import * as path from "path";
import {FunctionService} from "./function.service";
import {Function, FUNCTION_OPTIONS, Options} from "./interface";

@Injectable()
export class FunctionEngine {
  readonly schemas = new Map<string, JSONSchema7>();
  readonly runSchemas = new Map<string, JSONSchema7>();
  constructor(
    fs: FunctionService,
    private horizon: Horizon,
    @Inject(FUNCTION_OPTIONS) private options: Options
  ) {
    this.schemas.set("http", require("./schema/http.json"));
    fs.find().then(fns => fns.forEach(fn => this.subscribe(fn)));
  }

  update(fn: Function, index: string) {}

  read(fn: Function) {}

  getEnqueuer(name: string) {
    const enq = Array.from(this.horizon.enqueuers);
    return enq.find(e => e.description.name == name);
  }

  subscribe(fn: Function) {

    const handlers = Object.keys(fn.triggers);
    for (const handlerKey of handlers) {
      const handler = fn.triggers[handlerKey];
      const enqueuer = this.getEnqueuer(handler.type);
      if (enqueuer) {
        console.log(fn, handler.options);
        const target = new Event.Target();
        target.cwd = path.join(this.options.root, fn._id.toString());
        target.handler = handlerKey;
        enqueuer.subscribe(target, handler.options);
      } else {
        console.warn(`Couldn't find enqueuer ${handler.type}.`);
      }
    }
  }

  unsubscribe(fn: Function) {}
}
