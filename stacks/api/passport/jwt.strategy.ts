import {Inject, Injectable} from "@nestjs/common";
import {PassportStrategy} from "@nestjs/passport";
import {ExtractJwt, Strategy} from "passport-jwt";
import {PassportOptions, PASSPORT_OPTIONS} from "./interface";
import {PassportService} from "./passport.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private passport: PassportService,
    @Inject(PASSPORT_OPTIONS) options: PassportOptions
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("JWT"),
      ...options
    });
  }

  async validate(payload: any) {
    const identity = await this.passport.getIdentity({identifier: payload.identifier});
    return identity;
  }
}
