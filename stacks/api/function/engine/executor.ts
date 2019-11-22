// @ts-ignore
import * as child_process from "child_process";
import * as path from "path";

import {Execution} from "./interface";

export abstract class FunctionExecutor {
  abstract execute(execution: Execution): Promise<any>;
}

export class NodeExecutor extends FunctionExecutor {
  execute(execution: Execution): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = child_process.fork(path.join(__dirname, "runtime", "node.js"), [], {
        stdio: "inherit",
        env: {
          FUNCTION_SCRIPT: path.join(execution.cwd, 'index.ts')
        },
        cwd: execution.cwd,
        detached: true
      });

      worker.once("error", e => {
        reject(e);
      });

      worker.once("exit", (code, signal) => {
        resolve(code);
        console.log(code, signal);
      });
    });
  }
}
