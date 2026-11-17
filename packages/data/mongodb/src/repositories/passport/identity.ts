import {Inject, Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ReturnDocument} from "@spica-server/database";
import {Id, ProfilerQuery} from "@spica-server/interface-data";
import {FactorMeta} from "@spica-server/interface-passport-authfactor";
import {
  Identity,
  IDENTITY_OPTIONS,
  IdentityOptions,
  IdentityRepository
} from "@spica-server/interface-passport-identity";
import {translateWriteError} from "../errors.js";
import {readProfiler} from "../profiler.js";

const WITHOUT_PASSWORDS = {password: 0, lastPasswords: 0} as const;

@Injectable()
export class MongoIdentityRepository
  extends BaseCollection<Identity>("identity")
  implements IdentityRepository
{
  constructor(database: DatabaseService, @Inject(IDENTITY_OPTIONS) options: IdentityOptions) {
    super(database, {
      entryLimit: options.entryLimit,
      afterInit: () => this._coll.createIndex({identifier: 1}, {unique: true})
    });
  }

  findById(id: Id, hiddenFields?: {[path: string]: 0}) {
    return this.findOne({_id: id}, hiddenFields ? {projection: hiddenFields} : undefined);
  }

  findByIdentifier(identifier: string) {
    return this.findOne({identifier});
  }

  findWithAuthFactor() {
    return this.find({authFactor: {$exists: true, $ne: null}});
  }

  insert(identity: Identity) {
    return this.insertOne(identity).catch(translateWriteError);
  }

  insertIfMissing(identity: Identity) {
    return this.updateOne(
      {identifier: identity.identifier},
      {$setOnInsert: identity},
      {upsert: true}
    );
  }

  updateById(id: Id, changes: Partial<Identity>) {
    return this.findOneAndUpdate(
      {_id: id},
      {$set: changes},
      {returnDocument: ReturnDocument.AFTER}
    ).catch(translateWriteError);
  }

  async updateLoginState(
    identifier: string,
    state: Pick<Identity, "failedAttempts" | "lastLogin">
  ) {
    await this.findOneAndUpdate(
      {identifier},
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

  estimatedCount() {
    return this.estimatedDocumentCount();
  }

  status() {
    return this.getStatus() as Promise<{limit?: number; current: number; unit: "count"}>;
  }

  profilerEntries(query: ProfilerQuery) {
    return readProfiler(this.findOnProfiler(query.filter), query);
  }
}
