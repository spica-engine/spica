import {register} from "@spica-server/status";
import {StatusService} from "@spica-server/status/services";

export function registerStatusProvider(service: StatusService) {
  const provide = async () => {
    return {
      module: "api",
      status: await service._getStatus()
    };
  };

  register({module: "api", provide});
}
