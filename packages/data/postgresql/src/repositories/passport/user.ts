import {Inject, Injectable} from "@nestjs/common";
import {increment, isNotNull, jsonbMerge, jsonbSet, Orm} from "@spica-server/data-postgresql-orm";
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
import {StoredVerification, users, verifications} from "../../entities/index.js";
import {ORM} from "../../orm.js";
import {
  addPolicy,
  assertCapacity,
  entryStatus,
  omitPaths,
  removePolicy,
  removePolicyFromAll
} from "../helpers.js";

const PASSWORD_FIELDS = ["password", "lastPasswords"];

@Injectable()
export class PostgresUserRepository implements UserRepository {
  constructor(
    @Inject(ORM) private readonly orm: Orm,
    @Inject(USER_OPTIONS) private readonly options: UserOptions
  ) {}

  findById(id: Id) {
    return this.orm.findById(users, id);
  }

  findByUsername(username: string) {
    return this.orm.findOne(users, {username});
  }

  findWithAuthFactor() {
    return this.orm.findMany(users, {"authFactor.type": isNotNull()});
  }

  async insert(user: User) {
    await assertCapacity(this.orm, users, this.options.entryLimit);
    return this.orm.insert(users, user);
  }

  async insertIfMissing(user: User) {
    const inserted = await this.orm.upsert(users, user, {conflict: ["username"], update: []});
    return inserted ? 1 : 0;
  }

  updateById(id: Id, changes: Partial<User>) {
    return this.orm.updateById(users, id, changes);
  }

  async setFields(id: Id, fields: Record<string, unknown>) {
    const changes: Record<string, unknown> = {};
    const nested: Record<string, Record<string, unknown>> = {};
    for (const [path, value] of Object.entries(fields)) {
      const [root, ...rest] = path.split(".");
      if (!rest.length || users.byProperty.has(path) || users.groups.has(path)) {
        changes[path] = value;
      } else {
        (nested[root] ??= {})[rest.join(".")] = value;
      }
    }
    for (const [root, entries] of Object.entries(nested)) {
      changes[root] = jsonbSet(entries);
    }
    await this.orm.updateById(users, id, changes);
  }

  async setAttributes(id: Id, attributes: Record<string, unknown>) {
    return this.orm.updateById(users, id, {attributes: jsonbMerge(attributes)});
  }

  async updateLoginState(username: string, state: Pick<User, "failedAttempts" | "lastLogin">) {
    await this.orm.updateMany(
      users,
      {username},
      {failedAttempts: state.failedAttempts, lastLogin: state.lastLogin}
    );
  }

  async setAuthFactor(id: Id, authFactor: FactorMeta) {
    await this.orm.updateById(users, id, {authFactor});
  }

  removeAuthFactor(id: Id) {
    return this.orm.updateById(users, id, {authFactor: null}, {returning: "before"});
  }

  async addPolicy(id: Id, policyId: string) {
    return omitPaths(await addPolicy(this.orm, users, id, policyId), PASSWORD_FIELDS);
  }

  async removePolicy(id: Id, policyId: string) {
    return omitPaths(await removePolicy(this.orm, users, id, policyId), PASSWORD_FIELDS);
  }

  removePolicyFromAll(policyId: string) {
    return removePolicyFromAll(this.orm, users, policyId);
  }

  async deleteById(id: Id) {
    return (await this.orm.deleteById(users, id)) ? 1 : 0;
  }

  status() {
    return entryStatus(this.orm, users, this.options.entryLimit);
  }

  async profilerEntries(_query: ProfilerQuery) {
    return [];
  }
}

@Injectable()
export class PostgresVerificationRepository implements VerificationRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  async applyExpiry() {}

  async consume(target: VerificationTarget & {provider: string}) {
    const [verification] = await this.orm.updateMany(
      verifications,
      {
        userId: target.userId,
        strategy: target.strategy,
        provider: target.provider,
        purpose: target.purpose,
        is_used: false
      },
      {is_used: true},
      {returning: "before"}
    );
    return verification ?? null;
  }

  async upsertPending(
    target: VerificationTarget,
    pending: {destination: string; provider: string; code: string}
  ) {
    const verification = await this.orm.upsert(
      verifications,
      {...target, ...pending, requestCount: 1},
      {
        conflict: ["userId", "strategy", "purpose"],
        conflictWhere: {is_used: false},
        update: ["code"],
        set: {requestCount: increment(1)}
      }
    );
    return verification as StoredVerification & {_id: Id};
  }

  async deleteById(id: Id) {
    await this.orm.deleteById(verifications, id);
  }
}
