import {register} from "@spica/api/src/status";
import {StatusService} from "@spica/api/src/status/services";

export function registerStatusProvider(service: StatusService) {
  const provide = async (begin: Date, end: Date) => {
    return {
      module: "api",
      status: await service._getStatus(begin, end)
    };
  };

  register({module: "api", provide});
}
