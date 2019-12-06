import {Injectable} from "@nestjs/common";
import * as shortId from "short-id";
import {FunctionExecutor} from "./executor";
import {FunctionHost} from "./host";
import {Execution, Function, FunctionInfo} from "./interface";
import {LoggerHost} from "./logger";
import {EngineRegistry} from "./registry";
import {Context, InvokerFn, Target} from "./trigger/base";

@Injectable()
export class FunctionEngine {
  constructor(
    public host: FunctionHost<Function>,
    public logger: LoggerHost,
    private executor: FunctionExecutor,
    private registry: EngineRegistry
  ) {}

  // Introduce the function to triggers
  // This method only registers the function to triggers.
  introduce(fn: Function) {
    const triggers = Object.keys(fn.triggers);
    const script = this.host.read(fn);

    if (script.match(/__init__/g)) {
      this.init(fn);
    }
    triggers.forEach(t => {
      const meta = fn.triggers[t];
      const trigger = this.registry.getTrigger(meta.type);

      if (trigger && meta.active) {
        const target: Target = {handler: t, id: fn._id.toString()};
        const invoker: InvokerFn = async invocation => {
          const context: Context = {process: {env: fn.env}};
          const execution: Execution = {
            id: shortId.generate(),
            script: script,
            cwd: this.host.getRoot(fn),
            timeout: fn.timeout,
            memoryLimit: fn.memoryLimit,
            context: context,
            logger: null, //Lazy
            modules: this.registry.getModules(),
            parameters: invocation.parameters,
            target: invocation.target
          };
          execution.logger = await this.logger.create(execution);
          return this.executor
            .execute(execution)
            .then(() => execution.logger._destroy())
            .catch(() => execution.logger._destroy());
        };
        trigger.register(invoker, target, meta.options);
      } else if (trigger && !meta.active) {
        const target: Target = {handler: t, id: fn._id.toString()};
        trigger.register(null, target, meta.options);
      }
    });
  }

  private async init(fn: Function) {
    const script = this.host.read(fn);
    const context: Context = {process: {env: fn.env}};
    const execution: Execution = {
      id: shortId.generate(),
      script: script,
      cwd: this.host.getRoot(fn),
      timeout: fn.timeout,
      memoryLimit: fn.memoryLimit,
      context: context,
      logger: null, //Lazy
      modules: this.registry.getModules(),
      parameters: [],
      target: {id: fn._id.toString(), handler: "__init__"}
    };

    execution.logger = await this.logger.create(execution);

    return this.executor.execute(execution);
  }

  async run(fn: Function, target: Target, stream: NodeJS.WritableStream) {
    const trigger = this.registry.getTrigger(fn.triggers[target.handler].type);
    const script = this.host.read(fn);
    const context: Context = {process: {env: fn.env}};
    const execution: Execution = {
      id: shortId.generate(),
      script: script,
      cwd: this.host.getRoot(fn),
      timeout: fn.timeout,
      memoryLimit: fn.memoryLimit,
      context: context,
      logger: null, //Lazy
      modules: this.registry.getModules(),
      parameters: null, // Lazy
      target
    };

    execution.logger = await this.logger.create(execution, stream);

    return trigger
      .stub({}, execution.logger.info)
      .then(parameters => {
        execution.parameters = parameters;
        return this.executor.execute(execution);
      })
      .then(() => {
        stream.write(JSON.stringify({type: "event", state: "succeeded"}));
        execution.logger._destroy();
      })
      .catch(() => {
        stream.write(JSON.stringify({type: "event", state: "failed"}));
        execution.logger._destroy();
      });
  }

  async info(fn: Function): Promise<FunctionInfo> {
    return Object.keys(fn.triggers).reduce(
      async (accumulator, handler) => {
        const data = fn.triggers[handler];
        const trigger = this.registry.getTrigger(data.type);
        accumulator[handler] = await trigger.info(data.options);
        return accumulator;
      },
      {} as any
    );
  }

  // This function removes all triggers which able to trigger it.
  refuse(fn: Function) {
    const triggers = Object.keys(fn.triggers);
    triggers.forEach(t => {
      const meta = fn.triggers[t];
      const trigger = this.registry.getTrigger(meta.type);
      const target: Target = {handler: t, id: fn._id.toString()};
      trigger.register(null, target, meta.options);
    });
  }
}
