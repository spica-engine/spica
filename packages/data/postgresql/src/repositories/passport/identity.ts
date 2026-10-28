import {Inject, Injectable} from "@nestjs/common";
import {isNotNull, Orm} from "@spica-server/data-postgresql-orm";
import {Id, ProfilerQuery} from "@spica-server/interface-data";
import {FactorMeta} from "@spica-server/interface-passport-authfactor";
import {
  Identity,
  IDENTITY_OPTIONS,
  IdentityOptions,
  IdentityRepository
} from "@spica-server/interface-passport-identity";
import {identities} from "../../entities/index.js";
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
export class PostgresIdentityRepository implements IdentityRepository {
  constructor(
    @Inject(ORM) private readonly orm: Orm,
    @Inject(IDENTITY_OPTIONS) private readonly options: IdentityOptions
  ) {}

  async findById(id: Id, hiddenFields?: {[path: string]: 0}) {
    const identity = await this.orm.findById(identities, id);
    return hiddenFields ? omitPaths(identity, Object.keys(hiddenFields)) : identity;
  }

  findByIdentifier(identifier: string) {
    return this.orm.findOne(identities, {identifier});
  }

  findWithAuthFactor() {
    return this.orm.findMany(identities, {"authFactor.type": isNotNull()});
  }

  async insert(identity: Identity) {
    await assertCapacity(this.orm, identities, this.options.entryLimit);
    return this.orm.insert(identities, identity);
  }

  async insertIfMissing(identity: Identity) {
    const inserted = await this.orm.upsert(identities, identity, {
      conflict: ["identifier"],
      update: []
    });
    return inserted ? 1 : 0;
  }

  updateById(id: Id, changes: Partial<Identity>) {
    return this.orm.updateById(identities, id, changes);
  }

  async updateLoginState(
    identifier: string,
    state: Pick<Identity, "failedAttempts" | "lastLogin">
  ) {
    await this.orm.updateMany(
      identities,
      {identifier},
      {failedAttempts: state.failedAttempts, lastLogin: state.lastLogin}
    );
  }

  async setAuthFactor(id: Id, authFactor: FactorMeta) {
    await this.orm.updateById(identities, id, {authFactor});
  }

  removeAuthFactor(id: Id) {
    return this.orm.updateById(identities, id, {authFactor: null}, {returning: "before"});
  }

  async addPolicy(id: Id, policyId: string) {
    return omitPaths(await addPolicy(this.orm, identities, id, policyId), PASSWORD_FIELDS);
  }

  async removePolicy(id: Id, policyId: string) {
    return omitPaths(await removePolicy(this.orm, identities, id, policyId), PASSWORD_FIELDS);
  }

  removePolicyFromAll(policyId: string) {
    return removePolicyFromAll(this.orm, identities, policyId);
  }

  async deleteById(id: Id) {
    return (await this.orm.deleteById(identities, id)) ? 1 : 0;
  }

  estimatedCount() {
    return this.orm.count(identities);
  }

  status() {
    return entryStatus(this.orm, identities, this.options.entryLimit);
  }

  async profilerEntries(_query: ProfilerQuery) {
    return [];
  }
}
