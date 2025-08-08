import {register} from "..";
import {StatusService} from "../services";

export function registerStatusProvider(service: StatusService) {
  const provide = async (begin: Date, end: Date) => {
    return {
      module: "api",
      status: await service._getStatus(begin, end)
    };
  };

  register({module: "api", provide});
}
