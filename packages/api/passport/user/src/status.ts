import {register} from "@spica-server/status";
import {UserRepository} from "@spica-server/interface-passport-user";

export async function registerStatusProvider(users: UserRepository) {
  const provide = async () => {
    return {
      module: "user",
      status: {
        users: await users.status()
      }
    };
  };

  register({module: "user", provide});
}
