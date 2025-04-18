import {BadRequestException, Inject, Injectable, UnauthorizedException} from "@nestjs/common";
import {PassportStrategy} from "@nestjs/passport";
import {ExtractJwt, Strategy} from "passport-jwt";
import {IdentityService} from "./identity.service";
import {IdentityOptions, IDENTITY_OPTIONS} from "@spica-server/interface/passport/identity";

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

  async validate(request: any) {
    const {identifier} = request.header;
    const {iat} = request.payload;

    const user = await this.identity.findOne({identifier});
    if (!user) return undefined;

    const deactivateJwtsBefore = user["deactivateJwtsBefore"];
    const jwtDeactivationTimestamp =
      typeof deactivateJwtsBefore === "number" ? deactivateJwtsBefore : 0;

    if (iat < jwtDeactivationTimestamp) {
      throw new Error("Invalid JWT");
    }

    return user;
  }
}
