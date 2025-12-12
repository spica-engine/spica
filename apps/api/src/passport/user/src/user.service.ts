import {Injectable, Inject, UnauthorizedException} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {User, USER_OPTIONS, UserOptions} from "@spica-server/interface/passport/user";
import {Validator} from "@spica-server/core/schema";
import {Default} from "@spica-server/interface/core";
import {hash, compare} from "./hash";
import {JwtService, JwtSignOptions} from "@nestjs/jwt";
import {RefreshTokenService} from "@spica-server/passport/refresh_token/services";
import {v4 as uuidv4} from "uuid";

@Injectable()
export class UserService extends BaseCollection<User>("user") {
  constructor(
    database: DatabaseService,
    private validator: Validator,
    private jwt: JwtService,
    private refreshTokenService: RefreshTokenService,
    @Inject(USER_OPTIONS) private userOptions: UserOptions
  ) {
    super(database, {
      entryLimit: userOptions.entryLimit,
      afterInit: () => this._coll.createIndex({username: 1}, {unique: true})
    });
  }

  getPredefinedDefaults(): Default[] {
    return this.validator.defaults;
  }

  sign(user: User, requestedExpires?: number) {
    const expiresIn = this.getAccessTokenExpiresIn(requestedExpires);

    type CustomJwtHeader = JwtSignOptions["header"] & {
      username?: string;
      policies?: string[];
    };

    const token = this.jwt.sign(
      {...user, password: undefined, lastPasswords: undefined},
      {
        header: {
          username: user.username,
          policies: user.policies
        } as CustomJwtHeader,
        expiresIn
      }
    );

    return {
      scheme: "USER",
      token,
      issuer: "passport/user"
    };
  }

  getAccessTokenExpiresIn(requestedExpiresIn?: number) {
    if (requestedExpiresIn) {
      return Math.min(requestedExpiresIn, this.userOptions.maxExpiresIn);
    }
    return this.userOptions.expiresIn;
  }

  async signRefreshToken(user: User) {
    const expiresIn = this.userOptions.refreshTokenExpiresIn;
    const token = this.jwt.sign({username: user.username, uuid: uuidv4()}, {expiresIn});

    const tokenSchema = {
      token,
      user: String(user._id),
      created_at: new Date(),
      expired_at: new Date(Date.now() + expiresIn * 1000),
      last_used_at: undefined
    };

    await this.refreshTokenService.insertOne(tokenSchema);

    return tokenSchema;
  }

  private extractAccessToken(authHeader: string) {
    return authHeader.split(" ")[1];
  }

  private async verifyTokenCanBeRefreshed(accessToken: string, refreshToken: string) {
    await this.verify(accessToken);
    await this.verify(refreshToken);
  }

  private async verifyTokenUsernamesAreMatched(accessToken: string, refreshToken: string) {
    const refreshTokenData = await this.refreshTokenService.findOne({token: refreshToken});
    if (!refreshTokenData) {
      return Promise.reject("Refresh token not found");
    }

    const user = await this.findUserOfToken(accessToken);

    if (refreshTokenData.user !== String(user._id)) {
      return Promise.reject("Refresh and access token usernames are mismatched");
    }

    return Promise.resolve();
  }

  private async findUserOfToken(token: string) {
    const decodedToken = this.decode(token);
    const username = decodedToken ? decodedToken.username : undefined;

    const user = await this.findOne({username});

    if (!user) {
      return Promise.reject("username does not exist");
    }
    return user;
  }

  async refreshToken(accessToken: string, refreshToken: string) {
    accessToken = this.extractAccessToken(accessToken);
    await this.verifyTokenCanBeRefreshed(accessToken, refreshToken);
    await this.verifyTokenUsernamesAreMatched(accessToken, refreshToken);
    await this.updateRefreshTokenLastUsedAt(refreshToken);
    const user = await this.findUserOfToken(accessToken);
    return this.sign(user);
  }

  updateRefreshTokenLastUsedAt(token: string) {
    return this.refreshTokenService.updateOne({token}, {$set: {last_used_at: new Date()}});
  }

  getCookieOptions(path: string) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      path: path,
      overwrite: true,
      // expects milliseconds but will be shown as seconds in the cookie header
      maxAge: this.userOptions.refreshTokenExpiresIn * 1000
    };
  }

  verify(token: string) {
    return this.jwt.verifyAsync(token);
  }

  decode<T extends string | {[key: string]: any} = {[key: string]: any}>(token: string): T | null {
    return this.jwt.decode(token) as unknown as T | null;
  }

  async login(username: string, password: string): Promise<User | null> {
    if (!password) {
      return null;
    }
    const user = await this.findOne({username});

    if (!user) {
      return null;
    }

    user.failedAttempts = user.failedAttempts || [];

    this.checkUserIsBlocked(user);
    this.checkUserBan(user);

    const matched = await compare(password, user.password);

    let result;

    if (matched) {
      user.lastLogin = new Date();
      user.failedAttempts = [];
      result = user;
    } else {
      const isLimitReached =
        user.failedAttempts.length == this.userOptions.blockingOptions.failedAttemptLimit;

      if (isLimitReached) {
        user.failedAttempts = [];
      }

      user.failedAttempts.push(new Date());

      result = null;
    }

    await this.findOneAndUpdate(
      {username},
      {$set: {failedAttempts: user.failedAttempts, lastLogin: user.lastLogin}}
    );

    this.checkUserIsBlocked(user);

    return result;
  }

  // @internal
  async default(user: User): Promise<void> {
    const hashedPassword = await hash(user.password);
    await this.updateOne(
      {username: user.username},
      {$setOnInsert: {...user, password: hashedPassword}},
      {upsert: true}
    );
  }

  isUserBlocked(user: User) {
    const lastFailedAttempts = user.failedAttempts.filter(attempt => attempt > user.lastLogin);

    const isAttemptLimitReached =
      lastFailedAttempts.length == this.userOptions.blockingOptions.failedAttemptLimit;

    const remainingBlockedSeconds = this.getRemainingBlockedSeconds(user);

    return isAttemptLimitReached ? remainingBlockedSeconds > 0 : false;
  }

  getRemainingBlockedSeconds(user: User) {
    const lastAttempt = user.failedAttempts[user.failedAttempts.length - 1];

    if (!lastAttempt) {
      return 0;
    }

    const secondsPassedFromLastFailedAttempt =
      (new Date().getTime() - lastAttempt.getTime()) / 1000;

    const remainingBlockedSeconds =
      this.userOptions.blockingOptions.blockDurationMinutes * 60 -
      secondsPassedFromLastFailedAttempt;

    return remainingBlockedSeconds;
  }

  checkUserIsBlocked(user: User) {
    if (this.isUserBlocked(user)) {
      const remainingBlockedSeconds = this.getRemainingBlockedSeconds(user);
      throw new UnauthorizedException(
        `Too many failed login attempts. Try again after ${this.formatRemainingDuration(
          remainingBlockedSeconds
        )}.`
      );
    }
  }

  checkUserBan(user: User) {
    if (user.banned_until && new Date() < user.banned_until) {
      const remainingSeconds = (user.banned_until.getTime() - new Date().getTime()) / 1000;
      throw new UnauthorizedException(
        `User is banned. Try again after ${this.formatRemainingDuration(remainingSeconds)}.`
      );
    }
  }

  formatRemainingDuration(remainingSeconds: number) {
    let result = [];

    const hours = Math.floor(remainingSeconds / (60 * 60));
    if (hours) {
      result.push(`${hours} hours`);
      remainingSeconds = remainingSeconds - hours * (60 * 60);
    }

    const minutes = Math.floor(remainingSeconds / 60);
    if (minutes) {
      result.push(`${minutes} minutes`);
      remainingSeconds = remainingSeconds - minutes * 60;
    }

    if (remainingSeconds) {
      result.push(`${Math.floor(remainingSeconds)} seconds`);
    }

    return result.join(" ");
  }
}
