import {Injectable} from "@nestjs/common";
import {IdentityService} from "./identity.service";
import {Identity} from "@spica-server/interface/passport/identity";
import {IAuthResolver} from "@spica-server/interface/bucket/common";

@Injectable()
export class AuthResolver implements IAuthResolver {
  properties = {};

  constructor(private identityService: IdentityService) {}

  getProperties(): object {
    return this.properties;
  }

  resolveRelations(identity: Identity, aggregation: object[]) {
    // we don't need to find identity
    return this.identityService._coll
      .aggregate([
        {
          $limit: 1
        },
        {
          $replaceWith: {$literal: identity}
        },
        ...aggregation
      ])
      .next();
  }
}
