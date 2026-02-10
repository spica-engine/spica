import {UserService} from "./user.service";
import {User, DecryptedUser} from "@spica-server/interface/passport/user";
import {Filter, FindOptions, WithId, ModifyResult} from "mongodb";

export async function findOne(
  userService: UserService,
  filter: Filter<User>,
  options?: FindOptions
): Promise<DecryptedUser | null> {
  const transformedFilter = transformProviderFilter(userService, filter);
  const user = await userService._coll.findOne(transformedFilter, options);
  if (!user) {
    return null;
  }

  return userService.decryptProviderFields(user);
}

export function transformProviderFilter(userService: UserService, filter: any): any {
  if (!filter || typeof filter !== "object") {
    return filter;
  }

  const transformedFilter = {...filter};

  if (transformedFilter.email) {
    const emailValue = extractProviderValue(transformedFilter.email);
    if (emailValue) {
      transformedFilter["email.hash"] = userService.hashProviderValue(emailValue);
      delete transformedFilter.email;
    }
  }

  if (transformedFilter.phone) {
    const phoneValue = extractProviderValue(transformedFilter.phone);
    if (phoneValue) {
      transformedFilter["phone.hash"] = userService.hashProviderValue(phoneValue);
      delete transformedFilter.phone;
    }
  }

  return transformedFilter;
}

function extractProviderValue(field: any): string | null {
  if (typeof field === "string") {
    return field;
  }
  if (field && typeof field === "object" && field.value) {
    return field.value;
  }
  return null;
}
