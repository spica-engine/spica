import {Injectable, Inject, UnauthorizedException} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {
  Identity,
  IDENTITY_OPTIONS,
  IdentityOptions
} from "@spica-server/interface/passport/identity";
import {Validator} from "@spica-server/core/schema";
import {Default} from "@spica-server/interface/core";
import {hash, compare} from "./hash";
import {JwtService, JwtSignOptions} from "@nestjs/jwt";
import {RefreshTokenService} from "@spica-server/passport/refresh_token/services";
import {v4 as uuidv4} from "uuid";

@Injectable()
export class IdentityService extends BaseCollection<Identity>("identity") {
  constructor(
    database: DatabaseService,
    private validator: Validator,
    private jwt: JwtService,
    private refreshTokenService: RefreshTokenService,
    @Inject(IDENTITY_OPTIONS) private identityOptions: IdentityOptions
  ) {
    super(database, {
      entryLimit: identityOptions.entryLimit,
      afterInit: () => this._coll.createIndex({identifier: 1}, {unique: true})
    });
  }

  getPredefinedDefaults(): Default[] {
    return this.validator.defaults;
  }

  sign(identity: Identity, requestedExpires?: number) {
    const expiresIn = this.getAccessTokenExpiresIn(requestedExpires);

    type CustomJwtHeader = JwtSignOptions["header"] & {
      identifier?: string;
      policies?: string[];
    };

    const token = this.jwt.sign(
      {...identity, password: undefined, lastPasswords: undefined},
      {
        header: {
          identifier: identity.identifier,
          policies: identity.policies
        } as CustomJwtHeader,
        expiresIn
      }
    );

    return {
      scheme: "IDENTITY",
      token,
      issuer: "passport/identity"
    };
  }

  getAccessTokenExpiresIn(requestedExpiresIn?: number) {
    if (requestedExpiresIn) {
      return Math.min(requestedExpiresIn, this.identityOptions.maxExpiresIn);
    }
    return this.identityOptions.expiresIn;
  }

  async signRefreshToken(identity: Identity) {
    const expiresIn = this.identityOptions.refreshTokenExpiresIn;
    const token = this.jwt.sign({identifier: identity.identifier, uuid: uuidv4()}, {expiresIn});

    const tokenSchema = {
      token,
      identity: String(identity._id),
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

  private async verifyTokenIdentifiersAreMatched(accessToken: string, refreshToken: string) {
    const refreshTokenData = await this.refreshTokenService.findOne({token: refreshToken});
    if (!refreshTokenData) {
      return Promise.reject("Refresh token not found");
    }

    if (refreshTokenData.disabled) {
      return Promise.reject("Refresh token is disabled");
    }

    const identity = await this.findIdentityOfToken(accessToken);

    if (refreshTokenData.identity !== String(identity._id)) {
      return Promise.reject("Refresh and access token identifiers are mismatched");
    }

    return Promise.resolve();
  }

  private async findIdentityOfToken(token: string) {
    const decodedToken = this.decode(token);
    const identifier = decodedToken ? decodedToken.identifier : undefined;

    const identity = await this.findOne({identifier});

    if (!identity) {
      return Promise.reject("Identifier does not exist");
    }
    return identity;
  }

  async refreshToken(accessToken: string, refreshToken: string) {
    accessToken = this.extractAccessToken(accessToken);
    await this.verifyTokenCanBeRefreshed(accessToken, refreshToken);
    await this.verifyTokenIdentifiersAreMatched(accessToken, refreshToken);
    await this.updateRefreshTokenLastUsedAt(refreshToken);
    const identity = await this.findIdentityOfToken(accessToken);
    return this.sign(identity);
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
      maxAge: this.identityOptions.refreshTokenExpiresIn * 1000
    };
  }

  verify(token: string) {
    return this.jwt.verifyAsync(token);
  }

  decode<T extends string | {[key: string]: any} = {[key: string]: any}>(token: string): T | null {
    return this.jwt.decode(token) as unknown as T | null;
  }

  async identify(identifier: string, password: string): Promise<Identity | null> {
    if (!password) {
      return null;
    }
    const identity = await this.findOne({identifier});

    if (!identity) {
      return null;
    }

    identity.failedAttempts = identity.failedAttempts || [];

    this.checkIdentityIsBlocked(identity);

    const matched = await compare(password, identity.password);

    let result;

    if (matched) {
      identity.lastLogin = new Date();
      identity.failedAttempts = [];
      result = identity;
    } else {
      const isLimitReached =
        identity.failedAttempts.length == this.identityOptions.blockingOptions.failedAttemptLimit;

      if (isLimitReached) {
        identity.failedAttempts = [];
      }

      identity.failedAttempts.push(new Date());

      result = null;
    }

    await this.findOneAndUpdate(
      {identifier},
      {$set: {failedAttempts: identity.failedAttempts, lastLogin: identity.lastLogin}}
    );

    this.checkIdentityIsBlocked(identity);

    return result;
  }

  // @internal
  async default(identity: Identity): Promise<void> {
    const hashedPassword = await hash(identity.password);
    await this.updateOne(
      {identifier: identity.identifier},
      {$setOnInsert: {...identity, password: hashedPassword}},
      {upsert: true}
    );
  }

  isIdentityBlocked(identity: Identity) {
    const lastFailedAttempts = identity.failedAttempts.filter(
      attempt => attempt > identity.lastLogin
    );

    const isAttemptLimitReached =
      lastFailedAttempts.length == this.identityOptions.blockingOptions.failedAttemptLimit;

    const remainingBlockedSeconds = this.getRemainingBlockedSeconds(identity);

    return isAttemptLimitReached ? remainingBlockedSeconds > 0 : false;
  }

  getRemainingBlockedSeconds(identity: Identity) {
    const lastAttempt = identity.failedAttempts[identity.failedAttempts.length - 1];

    if (!lastAttempt) {
      return 0;
    }

    const secondsPassedFromLastFailedAttempt =
      (new Date().getTime() - lastAttempt.getTime()) / 1000;

    const remainingBlockedSeconds =
      this.identityOptions.blockingOptions.blockDurationMinutes * 60 -
      secondsPassedFromLastFailedAttempt;

    return remainingBlockedSeconds;
  }

  checkIdentityIsBlocked(identity: Identity) {
    if (this.isIdentityBlocked(identity)) {
      const remainingBlockedSeconds = this.getRemainingBlockedSeconds(identity);
      throw new UnauthorizedException(
        `Too many failed login attempts. Try again after ${this.formatRemainingDuration(
          remainingBlockedSeconds
        )}.`
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
