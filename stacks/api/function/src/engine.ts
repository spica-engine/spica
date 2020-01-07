import {Inject, Injectable} from "@nestjs/common";
import {Horizon} from "@spica-server/function/horizon";
import {Event} from "@spica-server/function/queue/proto";
import * as fs from "fs";
import {JSONSchema7} from "json-schema";
import * as path from "path";
import {ChangeKind, FunctionService, TargetChange} from "./function.service";
import {Function, FUNCTION_OPTIONS, Options} from "./interface";

@Injectable()
export class FunctionEngine {
  readonly schemas = new Map<string, JSONSchema7>();
  readonly runSchemas = new Map<string, JSONSchema7>();

  constructor(
    private fs: FunctionService,
    private horizon: Horizon,
    @Inject(FUNCTION_OPTIONS) private options: Options
  ) {
    this.schemas.set("http", require("./schema/http.json"));
    this.fs.targets().subscribe(change => {
      switch (change.kind) {
        case ChangeKind.Added:
          this.subscribe(change);
          break;
        case ChangeKind.Updated:
          this.unsubscribe(path.join(this.options.root, change.target.id));
          this.subscribe(change);
          break;
        case ChangeKind.Removed:
          this.unsubscribe(path.join(this.options.root, change.target.id));
          break;
      }
    });
  }

  async update(fn: Function, index: string): Promise<void> {
    const functionRoot = path.join(this.options.root, fn._id.toString());
    await fs.promises.mkdir(functionRoot, {recursive: true});
    await fs.promises.writeFile(path.join(functionRoot, "index.ts"), index);
    return this.horizon.runtime.compile({
      cwd: functionRoot,
      entrypoint: "index.ts"
    });
  }

  read(fn: Function): Promise<string> {
    const functionRoot = path.join(this.options.root, fn._id.toString());
    return fs.promises.readFile(path.join(functionRoot, "index.ts")).then(b => b.toString());
  }

  getEnqueuer(name: string) {
    const enq = Array.from(this.horizon.enqueuers);
    return enq.find(e => e.description.name == name);
  }

  subscribe(change: TargetChange) {
    const enqueuer = this.getEnqueuer(change.type);
    if (enqueuer) {
      const target = new Event.Target();
      target.cwd = path.join(this.options.root, change.target.id);
      target.handler = change.target.handler;
      enqueuer.subscribe(target, change.options);
    } else {
      console.warn(`Couldn't find enqueuer ${change.type}.`);
    }
  }

  unsubscribe(cwd: string) {
    for (const enqueuer of this.horizon.enqueuers) {
      const target = new Event.Target();
      target.cwd = cwd;
      enqueuer.unsubscribe(target);
    }
  }
}
