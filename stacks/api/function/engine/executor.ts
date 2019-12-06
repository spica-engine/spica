import * as async_hooks from "async_hooks";
import * as path from "path";
import * as ts from "typescript";
import {NodeVM} from "vm2";
import {Execution} from "./interface";

export abstract class FunctionExecutor {
  abstract execute(execution: Execution): Promise<any>;
}

export class VM2Executor extends FunctionExecutor {
  execute(execution: Execution): Promise<any> {
    return new Promise(async (resolve, reject) => {
      let hook: async_hooks.AsyncHook;
      let timeout: NodeJS.Timeout;
      const queue = new Set<number>();
      let promises = new WeakSet();
      let result: any;
      let success = true;

      const rejected = (e, promise) => {
        if (promises.has(promise)) {
          result = e;
          success = false;
        }
      };

      const finish = () => {
        process.off("unhandledRejection", rejected);

        if (success) {
          resolve(result);
        } else {
          reject(result);
        }
      };

      process.on("unhandledRejection", rejected);

      const vm = new NodeVM({
        timeout: execution.timeout || 100,
        sandbox: {console: execution.logger, exports: {}, ...execution.context},
        require: {
          mock: execution.modules,
          external: true,
          builtin: ["*"]
        },
        compiler: (code: string) => {
          return ts.transpileModule(code, {
            compilerOptions: {
              module: ts.ModuleKind.CommonJS,
              target: ts.ScriptTarget.ES2018
            }
          }).outputText;
        }
      });

      hook = async_hooks.createHook({
        init: (asyncId, type, triggerAsyncId, resource) => {
          if (type == "PROMISE") {
            promises.add(resource["promise"]);
          }
        },
        before: asyncId => queue.add(asyncId),
        after: asyncId => queue.delete(asyncId),
        destroy: asyncId => queue.delete(asyncId),
        promiseResolve: asyncId => {
          queue.delete(asyncId);
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            if (queue.size <= 1) {
              finish();
            }
          }, 1);
        }
      });

      hook.enable();
      try {
        result = await vm
          .run(execution.script, path.join(execution.cwd, "index.ts"))
          [execution.target.handler](...execution.parameters);
      } catch (e) {
        // Capture sync errors
        success = false;
        result = e;
        if (!queue.size) {
          finish();
        }
      }

      hook.disable();
    }).catch(error => {
      // We have to catch any errors to forward
      // it to logger manually since the vm2
      // Cannot catch async error that occurs in
      // async contexts
      execution.logger.error(error);
      return Promise.reject(error);
    });
  }
}
