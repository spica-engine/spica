import {BadRequestException, Inject, Injectable, UnauthorizedException} from "@nestjs/common";
import {PassportStrategy} from "@nestjs/passport";
import {ExtractJwt, Strategy} from "passport-jwt";
import {
  UserOptions,
  USER_OPTIONS,
  USER_REPOSITORY,
  UserRepository
} from "@spica-server/interface-passport-user";

@Injectable()
export class UserStrategy extends PassportStrategy(Strategy, "user") {
  constructor(
    @Inject(USER_REPOSITORY) private users: UserRepository,
    @Inject(USER_OPTIONS) options: UserOptions
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("USER"),
      ...options,
      jsonWebTokenOptions: {
        complete: true
      }
    });
  }

  async validate(request: any) {
    const {username} = request.header;
    const {iat} = request.payload;

    const user = await this.users.findByUsername(username);
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
