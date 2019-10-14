import * as ivm from "isolated-vm";
import {Execution} from "./interface";
import ts = require("typescript/lib/tsserverlibrary");

export abstract class FunctionExecutor {
  abstract execute(execution: Execution): Promise<any>;
}

export class IsolatedVMExecutor extends FunctionExecutor {
  async execute(execution: Execution): Promise<any> {
    const code = ts.transpileModule(execution.script, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2019,
        noImplicitUseStrict: true
      }
    }).outputText;

    const vm = new ivm.Isolate({memoryLimit: execution.memoryLimit});
    const ctx = vm.createContextSync();
    const global = ctx.global;
    global.setSync("global", global.derefInto());
    global.setSync("ivm", ivm);

    const modules = {
      runtime: vm.compileModuleSync(
        // Prepare resolver function
        `export function resolve(val) {
            if (val instanceof ivm.Reference) {
              console.log('ref');
              switch (val.typeof) {
                case "function":
                  return function(...args) {
                    val.applyIgnored(
                      undefined,
                      args.map(arg => new ivm.ExternalCopy(arg).copyInto())
                    );
                  };
                case "object":
                  const actualValue = val.copySync();
                  return Object.keys(actualValue).reduce((accumulator, key) => {
                    accumulator[key] = resolve(actualValue[key]);
                    return accumulator;
                  }, {});
                default:
                  return val.copySync();
              }
            } else if (val instanceof ivm.ExternalCopy) {
              return val.copy();
            } else {
              return val;
            }
        }`
      )
    };

    global.setSync("console", this.makeTransferable(execution.logger));

    const closure = vm.compileModuleSync(
      `
    import {resolve} from 'runtime';
    import {${execution.target.handler}} from 'function';

    global.console = resolve(global.console);

    export function closure_${execution.id}(...args) {
      const res = ${execution.target.handler}(...args.map((p) => resolve(p)));
      console.log(res);
      return new ivm.ExternalCopy(res).copyInto();
    }`,
      {filename: "closure.js"}
    );

    closure.instantiateSync(ctx, specifier =>
      specifier == "function" ? vm.compileModuleSync(code) : modules[specifier]
    );

    closure.evaluateSync();

    const fn = closure.namespace.getSync(`closure_${execution.id}`);
    return fn
      .apply(undefined, execution.parameters.map(param => this.makeTransferable(param)), {
        timeout: execution.timeout
      })
      .then(() => {
        console.log(vm.cpuTime, vm.wallTime, vm.referenceCount, vm.getHeapStatisticsSync());
        if (!vm.isDisposed) {
          vm.dispose();
        }
      })
      .catch(error => {
        if (!vm.isDisposed) {
          vm.dispose();
        }
        return Promise.reject(error);
      });
  }

  private makeTransferable(value: any): ivm.Transferable {
    switch (typeof value) {
      case "function":
        return new ivm.Reference((...args) => value(...args));
      case "object":
        return !value
          ? value
          : Object.getOwnPropertyNames(value)
              .filter(k => !k.startsWith("_"))
              .reduce((accumulator, key) => {
                accumulator.setSync(key, this.makeTransferable(value[key]));
                return accumulator;
              }, new ivm.Reference({}));
      default:
        return new ivm.ExternalCopy(value);
    }
  }
}
