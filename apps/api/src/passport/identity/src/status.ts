import {register} from "@spica-server/status";
import {IdentityService} from "./identity.service";

export async function registerStatusProvider(service: IdentityService) {
  const provide = async () => {
    return {
      module: "identity",
      status: {
        identities: await service.getStatus()
      }
    };
  };

  register({module: "identity", provide});
}
