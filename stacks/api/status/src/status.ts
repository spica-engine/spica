import {register} from "@spica-server/status";
import {StatusService} from "@spica-server/status/services";

export function registerStatusProvider(service: StatusService) {
  const provide = async (begin: Date, end: Date) => {
    return {
      module: "api",
      status: await service.calculateHttpStatus(begin, end)
    };
  };

  register({module: "api", provide});
}
