import {Injectable} from "@nestjs/common";
import {PreferenceService} from "@spica-server/preference/services";
import {IdentityService} from "./identity.service";
import {Identity} from "./interface";
import {IAuthResolver} from "@spica-server/bucket/common";

@Injectable()
export class AuthResolver implements IAuthResolver {
  properties;

  constructor(private identityService: IdentityService, private prefService: PreferenceService) {
    this.prefService.watch("passport", {propagateOnStart: true}).subscribe(schema => {
      if (!schema || !schema.identity || !schema.identity.attributes) {
        this.properties = {};
      }

      schema.identity.attributes.type = "object";
      this.properties = schema.identity;
    });
  }

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
