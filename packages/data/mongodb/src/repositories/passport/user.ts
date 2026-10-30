import {Inject, Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ReturnDocument} from "@spica-server/database";
import {Id, ProfilerQuery} from "@spica-server/interface-data";
import {FactorMeta} from "@spica-server/interface-passport-authfactor";
import {
  User,
  USER_OPTIONS,
  UserOptions,
  UserRepository,
  UserVerification,
  VerificationRepository,
  VerificationTarget
} from "@spica-server/interface-passport-user";
import {translateWriteError} from "../errors.js";
import {readProfiler} from "../profiler.js";

const WITHOUT_PASSWORDS = {password: 0, lastPasswords: 0} as const;

@Injectable()
export class MongoUserRepository extends BaseCollection<User>("user") implements UserRepository {
  constructor(database: DatabaseService, @Inject(USER_OPTIONS) userOptions: UserOptions) {
    super(database, {
      entryLimit: userOptions.entryLimit,
      afterInit: () => {
        this._coll.createIndex({username: 1}, {unique: true});
        this._coll.createIndex(
          {"email.hash": 1},
          {unique: true, partialFilterExpression: {"email.hash": {$exists: true}}}
        );

        this._coll.createIndex(
          {"phone.hash": 1},
          {unique: true, partialFilterExpression: {"phone.hash": {$exists: true}}}
        );
      }
    });
  }

  findById(id: Id) {
    return this.findOne({_id: id});
  }

  findByUsername(username: string) {
    return this.findOne({username});
  }

  findWithAuthFactor() {
    return this.find({authFactor: {$exists: true, $ne: null}});
  }

  insert(user: User) {
    return this.insertOne(user).catch(translateWriteError);
  }

  insertIfMissing(user: User) {
    return this.updateOne({username: user.username}, {$setOnInsert: user}, {upsert: true});
  }

  updateById(id: Id, changes: Partial<User>) {
    return this.findOneAndUpdate(
      {_id: id},
      {$set: changes},
      {returnDocument: ReturnDocument.AFTER}
    ).catch(translateWriteError);
  }

  async setFields(id: Id, fields: Record<string, unknown>) {
    await this.updateOne({_id: id}, {$set: fields});
  }

  setAttributes(id: Id, attributes: Record<string, unknown>) {
    return this.findOneAndUpdate(
      {_id: id},
      {
        $set: Object.fromEntries(
          Object.entries(attributes).map(([key, value]) => [`attributes.${key}`, value])
        )
      },
      {returnDocument: ReturnDocument.AFTER}
    );
  }

  async updateLoginState(username: string, state: Pick<User, "failedAttempts" | "lastLogin">) {
    await this.findOneAndUpdate(
      {username},
      {$set: {failedAttempts: state.failedAttempts, lastLogin: state.lastLogin}}
    );
  }

  async setAuthFactor(id: Id, authFactor: FactorMeta) {
    await this.findOneAndUpdate({_id: id}, {$set: {authFactor}});
  }

  removeAuthFactor(id: Id) {
    return this.findOneAndUpdate({_id: id}, {$unset: {authFactor: ""}});
  }

  addPolicy(id: Id, policyId: string) {
    return this.findOneAndUpdate(
      {_id: id},
      {$addToSet: {policies: policyId}},
      {returnDocument: ReturnDocument.AFTER, projection: WITHOUT_PASSWORDS}
    );
  }

  removePolicy(id: Id, policyId: string) {
    return this.findOneAndUpdate(
      {_id: id},
      {$pull: {policies: policyId}},
      {returnDocument: ReturnDocument.AFTER, projection: WITHOUT_PASSWORDS}
    );
  }

  removePolicyFromAll(policyId: string) {
    return this.updateMany({policies: {$in: [policyId]}}, {$pull: {policies: policyId}});
  }

  deleteById(id: Id) {
    return this.deleteOne({_id: id});
  }

  status() {
    return this.getStatus() as Promise<{limit?: number; current: number; unit: "count"}>;
  }

  profilerEntries(query: ProfilerQuery) {
    return readProfiler(this.findOnProfiler(query.filter), query);
  }
}

const VERIFICATION_TTL_SECONDS = 300;

@Injectable()
export class MongoVerificationRepository
  extends BaseCollection<UserVerification>("verification")
  implements VerificationRepository
{
  constructor(
    db: DatabaseService,
    @Inject(USER_OPTIONS) private readonly userOptions: UserOptions
  ) {
    super(db);
  }

  async applyExpiry() {
    await this.upsertTTLIndex(
      this.userOptions.verificationCodeExpiresIn || VERIFICATION_TTL_SECONDS
    );
  }

  consume(target: VerificationTarget & {provider: string}) {
    return this.findOneAndUpdate(
      {
        userId: target.userId,
        strategy: target.strategy,
        provider: target.provider,
        purpose: target.purpose,
        is_used: false
      },
      {
        $set: {is_used: true}
      }
    );
  }

  upsertPending(
    target: VerificationTarget,
    pending: {destination: string; provider: string; code: string}
  ) {
    return this.findOneAndUpdate(
      {
        userId: target.userId,
        strategy: target.strategy,
        purpose: target.purpose,
        is_used: false
      },
      {
        $setOnInsert: {
          userId: target.userId,
          destination: pending.destination,
          provider: pending.provider,
          purpose: target.purpose,
          strategy: target.strategy,
          createdAt: new Date()
        },
        $inc: {
          requestCount: 1
        },
        $set: {
          code: pending.code
        }
      },
      {
        upsert: true,
        returnDocument: "after"
      }
    );
  }

  async deleteById(id: Id) {
    await this.findOneAndDelete({_id: id});
  }
}
