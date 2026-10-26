import {register} from "@spica-server/status";
import {IdentityRepository} from "@spica-server/interface-passport-identity";

export async function registerStatusProvider(identities: IdentityRepository) {
  const provide = async () => {
    return {
      module: "identity",
      status: {
        identities: await identities.status()
      }
    };
  };

  register({module: "identity", provide});
}
