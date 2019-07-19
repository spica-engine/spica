import {Inject, Injectable} from "@nestjs/common";
import {PassportStrategy} from "@nestjs/passport";
import {ExtractJwt, Strategy} from "passport-jwt";
import {PassportOptions, PASSPORT_OPTIONS} from "./interface";
import {IdentityService} from "./identity/identity.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private identity: IdentityService,
    @Inject(PASSPORT_OPTIONS) options: PassportOptions
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("JWT"),
      ...options
    });
  }

  async validate(payload: any) {
    const identity = await this.identity.findOne({identifier: payload.identifier});
    return identity;
  }
}
