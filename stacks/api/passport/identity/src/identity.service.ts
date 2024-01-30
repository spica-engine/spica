import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Identity} from "./interface";
import {Validator, Default} from "@spica-server/core/schema";
import {hash, compare} from "./hash";
import {JwtService} from "@nestjs/jwt";
import {IDENTITY_OPTIONS, IdentityOptions} from "./options";

@Injectable()
export class IdentityService extends BaseCollection<Identity>("identity") {
  constructor(
    database: DatabaseService,
    private validator: Validator,
    private jwt: JwtService,
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
    let expiresIn = this.identityOptions.expiresIn;
    if (requestedExpires) {
      expiresIn = Math.min(requestedExpires, this.identityOptions.maxExpiresIn);
    }

    const token = this.jwt.sign(
      {...identity, password: undefined},
      {
        header: {
          identifier: identity.identifier,
          policies: identity.policies
        },
        expiresIn
      }
    );

    return {
      scheme: "IDENTITY",
      token,
      issuer: "passport/identity"
    };
  }

  verify(token: string) {
    return this.jwt.verifyAsync(token);
  }

  async identify(identifier: string, password: string): Promise<Identity | null> {
    if (!password) {
      return null;
    }
    const identity = await this.findOne({identifier});

    if (!identity) {
      return null;
    }

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
      throw new Error(
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
