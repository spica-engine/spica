import {FunctionService} from "@spica-server/function/services";
import {register} from "@spica-server/status";
import {Scheduler} from "@spica-server/function/scheduler";
import {InvocationService} from "@spica-server/status/services";

export async function registerStatusProvider(
  fnService: FunctionService,
  scheduler: Scheduler,
  invocationService: InvocationService
) {
  const provide = async (begin?: Date, end?: Date) => {
    return {
      module: "function",
      status: {
        functions: await fnService.getStatus(),
        workers: scheduler.getStatus(),
        invocations: await invocationService.calculateInvocationStatus("function", begin, end)
      }
    };
  };

  const provideInvocations = async (begin?: Date, end?: Date) => {
    return {
      module: "function",
      submodule: "invocations",
      status: {
        invocations: await invocationService.findByModule("function", begin, end)
      }
    };
  };

  register({module: "function", provide});
  register({module: "function", submodule: "invocations", provide: provideInvocations});
}
