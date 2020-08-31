import {Inject, Injectable} from "@nestjs/common";
import {PassportStrategy} from "@nestjs/passport";
import {ExtractJwt, Strategy} from "passport-jwt";
import {IdentityService} from "./identity.service";
import {IdentityOptions, IDENTITY_OPTIONS} from "./options";

@Injectable()
export class IdentityStrategy extends PassportStrategy(Strategy, "identity") {
  constructor(
    private identity: IdentityService,
    @Inject(IDENTITY_OPTIONS) options: IdentityOptions
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("IDENTITY"),
      ...options,
      jsonWebTokenOptions: {
        complete: true
      }
    });
  }

  async validate({header}: any) {
    return this.identity.findOne({identifier: header.identifier});
  }
}
