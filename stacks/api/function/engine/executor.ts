import * as ivm from "isolated-vm";
import ts = require("typescript/lib/tsserverlibrary");
import {Execution} from "./interface";

export abstract class FunctionExecutor {
  abstract execute(execution: Execution): Promise<any>;
}

export class IsolatedVMExecutor extends FunctionExecutor {
  async execute(execution: Execution): Promise<any> {
    const code = ts.transpileModule(execution.script, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2019,
        noImplicitUseStrict: true
      }
    }).outputText;

    console.log(code);

    const vm = new ivm.Isolate({memoryLimit: execution.memoryLimit});
    const context = vm.createContextSync();
    const global = context.global;
    global.setSync("global", global.derefInto());
    global.setSync("ivm", ivm);

    global.setSync("console", this.makeTransferable(execution.logger));

    vm.compileScriptSync(
      `
    function resolve(val) {
      if ( val instanceof ivm.Reference ) {
        switch (val.typeof) {
          case 'function':
            return function (...args) { 
              val.applyIgnored(undefined, args.map(arg => new ivm.ExternalCopy(arg).copyInto()))
            }
          case 'object':
            const actualValue = val.copySync();
            return Object.keys(actualValue).reduce( (accumulator, key) => {
              accumulator[key] = resolve(actualValue[key]); 
              return accumulator;
            }, {});
          default:
            return val.copySync();
        }
      } else if ( val instanceof ivm.ExternalCopy ) {
        return val.copy();
      } else {
        return val;
      }
    }`
    ).runSync(context);

    vm.compileScriptSync(`global.console = resolve(global.console);`, {
      filename: "logger.spica.internal"
    }).runSync(context);

    const module = vm.compileModuleSync(code, {filename: `function@${execution.target.id}.js`});

    console.log(module.dependencySpecifiers);

    module.instantiateSync(context, (specifier, referrer) => {
      console.dir({specifier, referrer});
      return undefined;
    });

    vm.compileScriptSync(
      `function spica_internal(...params) {
        return exports.${execution.target.handler}(...params.map((p) => resolve(p)));
      }`,
      {filename: `bootstrap.spica.internal`}
    ).runSync(context);

    console.log('here')

    const fn = context.global.getSync(`spica_internal`);
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
        console.log(error, 'error');
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
              }, new ivm.Reference(value));
      default:
        return new ivm.ExternalCopy(value);
    }
  }
}
