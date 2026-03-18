import {register} from "@spica-server/status";
import {UserService} from "./user.service";

export async function registerStatusProvider(service: UserService) {
  const provide = async () => {
    return {
      module: "user",
      status: {
        users: await service.getStatus()
      }
    };
  };

  register({module: "user", provide});
}
