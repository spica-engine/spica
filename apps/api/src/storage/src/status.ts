import {register} from "@spica/api/src/status";
import {StorageService} from "./storage.service";

export async function registerStatusProvider(service: StorageService) {
  const provide = async () => {
    return {
      module: "storage",
      status: {
        size: await service.getStatus()
      }
    };
  };

  register({module: "storage", provide});
}
