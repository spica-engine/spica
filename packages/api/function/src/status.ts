import {FunctionService} from "@spica-server/function/services";
import {register} from "@spica-server/status";
import {Scheduler} from "@spica-server/function/scheduler";

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
