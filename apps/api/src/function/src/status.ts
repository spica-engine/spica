import {FunctionService} from "@spica/api/src/function/services";
import {register} from "@spica/api/src/status";
import {Scheduler} from "@spica/api/src/function/scheduler";

export async function registerStatusProvider(service: FunctionService, scheduler: Scheduler) {
  const provide = async () => {
    return {
      module: "function",
      status: {
        functions: await service.getStatus(),
        workers: scheduler.getStatus()
      }
    };
  };

  register({module: "function", provide});
}
