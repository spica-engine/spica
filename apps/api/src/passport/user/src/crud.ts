import {UserService} from "./user.service";
import {User, DecryptedUser} from "@spica-server/interface/passport/user";
import {Filter, FindOptions} from "@spica-server/database";
import {replaceProviderFilter} from "@spica-server/filter";

export async function findOne(
  userService: UserService,
  filter: Filter<User>,
  options?: FindOptions
): Promise<DecryptedUser | null> {
  const transformedFilter = transformProviderFilter(userService, filter);
  const user = await userService.findOne(transformedFilter, options);
  if (!user) {
    return null;
  }

  return userService.decryptProviderFields(user);
}

export function transformProviderFilter(userService: UserService, filter: object): object {
  if (!filter) {
    return filter;
  }

  return replaceProviderFilter(filter, value => userService.hashProviderValue(value));
}
