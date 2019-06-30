import * as ivm from 'isolated-vm';
import ts = require('typescript/lib/tsserverlibrary');
import { Execution } from './interface';

export abstract class FunctionExecutor {
  abstract execute(execution: Execution): Promise<any>;
}

export class IsolatedVMExecutor extends FunctionExecutor {
  async execute(execution: Execution): Promise<any> {
    const code = ts.transpileModule(execution.script, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2018,
        noImplicitUseStrict: false
      }
    }).outputText;

    const vm = new ivm.Isolate({ memoryLimit: execution.memoryLimit });
    let context = vm.createContextSync();
    let jail = context.global;
    jail.setSync('global', jail.derefInto());
    jail.setSync('ivm', ivm);

    jail.setSync('console', this.makeTransferable(execution.logger));

    vm.compileScriptSync(`
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
    }`).runSync(context);

    vm.compileScriptSync(
      `var exports = {};
      global.console = resolve(global.console);
      `,
      { filename: 'logger.spica.internal' }
    ).runSync(context);

    vm.compileScriptSync(code, { filename: `function@${execution.target.id}.js` }).runSync(context);


    vm.compileScriptSync(
      `function spica_internal(...params) {
        return exports.${execution.target.handler}(...params.map((p) => resolve(p)));
      }`,
      { filename: `bootstrap.spica.internal` }
    ).runSync(context);


    const fn = context.global.getSync(`spica_internal`);
    return fn.apply(undefined, execution.parameters.map(param => this.makeTransferable(param)), { timeout: execution.timeout })
      .then(() => {
        console.log(vm.cpuTime, vm.wallTime, vm.referenceCount, vm.getHeapStatisticsSync());
        if (!vm.isDisposed) {
          vm.dispose();
        }
      }).catch(error => {
        if (!vm.isDisposed) {
          vm.dispose();
        }
        return Promise.reject(error);
      })
  }

  private makeTransferable(value: any): ivm.Transferable {
    switch (typeof value) {
      case 'function':
        return new ivm.Reference((...args) => value(...args));
      case 'object':
        return !value ? value : Object.getOwnPropertyNames(value).filter(k => !k.startsWith('_')).reduce((accumulator, key) => {
          accumulator.setSync(key, this.makeTransferable(value[key]));
          return accumulator;
        }, new ivm.Reference(value));
      default:
        return new ivm.ExternalCopy(value);
    }
  }
}