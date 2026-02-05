import {Injectable} from "@nestjs/common";
import {PreferenceService} from "@spica-server/preference/services";
import {UserService} from "./user.service";
import {User} from "@spica-server/interface/passport/user";
import {IAuthResolver} from "@spica-server/interface/bucket/common";

@Injectable()
export class AuthResolver implements IAuthResolver {
  properties;

  constructor(
    private userService: UserService,
    private prefService: PreferenceService
  ) {
    this.prefService.watchPreference("passport", {propagateOnStart: true}).subscribe(schema => {
      if (!schema || !schema.user || !schema.user.attributes) {
        this.properties = {};
        return;
      }

      schema.user.attributes.type = "object";
      this.properties = schema.user;
    });
  }

  getProperties(): object {
    return this.properties;
  }

  resolveRelations(user: User, aggregation: object[]) {
    // we don't need to find user
    return this.userService._coll
      .aggregate([
        {
          $limit: 1
        },
        {
          $replaceWith: {$literal: user}
        },
        ...aggregation
      ])
      .next();
  }
}
