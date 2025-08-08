import {FunctionService} from "../services";
import {register} from "../../status";
import {Scheduler} from "../scheduler";

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
