import {Execution} from "./interface";
import * as ts from "typescript";
import {NodeVM} from "vm2";
import * as path from "path";

export abstract class FunctionExecutor {
  abstract execute(execution: Execution): Promise<any>;
}

export class VM2Executor extends FunctionExecutor {
  execute(execution: Execution): Promise<any> {
    return new Promise(resolve => {
      const vm = new NodeVM({
        timeout: execution.timeout || 100,
        sandbox: {console: execution.logger, exports: {}},
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

      const run = vm.run(execution.script, path.join(execution.cwd, "index.ts"));
      resolve(run[execution.target.handler](...execution.parameters));
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

/*
import * as ivm from 'isolated-vm';
export class IsolatedVMExecutor extends FunctionExecutor {
	execute(execution: Execution, fn: FFunction) {
		return new Promise(() => {
			const isolate = new ivm.Isolate({ memoryLimit: fn.memoryLimit || 128, inspector: true });
			const context = isolate.createContextSync();
			const jail = context.global;
			jail.setSync('global', jail.derefInto());
			jail.setSync('_ivm', ivm);
			jail.setSync(
				'_log',
				new ivm.Reference(function(...args) {
					console.log(...args, 'annen');
				})
			);
			const utilityScript = isolate.compileScriptSync(`new  function() {
                let ivm = _ivm;
                delete _ivm;

                let log = _log;
                delete _log;
                global.console.log = function(...args) {
                    log(undefined, args.map(arg => new ivm.ExternalCopy(arg).copyInto()));
                };
            }`);
			const transpiled = ts.transpileModule(fn.source, {
				compilerOptions: {
					module: ts.ModuleKind.CommonJS,
					target: ts.ScriptTarget.Latest,
					noImplicitUseStrict: true
				}
			}).outputText;
			const script = isolate.compileScriptSync(transpiled);
			return Promise.all([
				utilityScript.runSync(context),
				script.run(context, { timeout: fn.timeout || 20000 })
			]).then((d) => console.log(d));
		});
	}
}*/
