import {FunctionRepository} from "@spica-server/interface-function";
import {register} from "@spica-server/status";
import {Scheduler} from "@spica-server/function-scheduler";

export async function registerStatusProvider(functions: FunctionRepository, scheduler: Scheduler) {
  const provide = async () => {
    return {
      module: "function",
      status: {
        functions: await functions.status(),
        workers: scheduler.getStatus()
      }
    };
  };

  register({module: "function", provide});
}
