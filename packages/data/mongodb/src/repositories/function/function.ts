import {Inject, Injectable} from "@nestjs/common";
import {getUpdateQueryForPatch} from "@spica-server/core-patch";
import {BaseCollection, DatabaseService, ReturnDocument} from "@spica-server/database";
import {Id} from "@spica-server/interface-data";
import {
  Function,
  FUNCTION_OPTIONS,
  FunctionOptions,
  FunctionRepository
} from "@spica-server/interface-function";
import {translateWriteError} from "../errors.js";

@Injectable()
export class MongoFunctionRepository
  extends BaseCollection<Function>("function")
  implements FunctionRepository
{
  constructor(database: DatabaseService, @Inject(FUNCTION_OPTIONS) options: FunctionOptions) {
    super(database, {
      entryLimit: options.entryLimit,
      afterInit: () =>
        Promise.all([
          this.createIndex({env_vars: 1}),
          this.createIndex({secrets: 1}),
          this.createIndex({name: 1}, {unique: true})
        ])
    });
  }

  findAll() {
    return this.find();
  }

  findSummaries() {
    return this.find({}, {projection: {_id: 1, name: 1, language: 1}});
  }

  findById(id: Id) {
    return this.findOne({_id: id});
  }

  findByName(name: string) {
    return this.findOne({name});
  }

  findReferencing(field: "env_vars" | "secrets", resourceId: Id) {
    return this.find({[field]: {$in: [resourceId]}});
  }

  insert(fn: Function) {
    return this.insertOne(fn).catch(translateWriteError);
  }

  updateById(id: Id, changes: Partial<Function>) {
    return this.findOneAndUpdate({_id: id}, {$set: changes}).catch(translateWriteError);
  }

  async applyMergePatch(id: Id, patch: object, patched: Function) {
    const updateQuery = getUpdateQueryForPatch(patch, patched);

    if (!updateQuery) {
      return undefined;
    }

    return this.findOneAndUpdate({_id: id}, updateQuery, {
      returnDocument: ReturnDocument.AFTER
    });
  }

  replaceById(id: Id, fn: Function) {
    return this.replaceOne({_id: id}, fn);
  }

  deleteById(id: Id) {
    return this.findOneAndDelete({_id: id});
  }

  addEnvVar(id: Id, envVarId: Id) {
    return this.findOneAndUpdate({_id: id}, {$addToSet: {env_vars: envVarId}});
  }

  removeEnvVar(id: Id, envVarId: Id) {
    return this.findOneAndUpdate({_id: id}, {$pull: {env_vars: envVarId}});
  }

  addSecret(id: Id, secretId: Id) {
    return this.findOneAndUpdate({_id: id}, {$addToSet: {secrets: secretId}});
  }

  removeSecret(id: Id, secretId: Id) {
    return this.findOneAndUpdate({_id: id}, {$pull: {secrets: secretId}});
  }

  status() {
    return this.getStatus() as Promise<{limit?: number; current: number; unit: "count"}>;
  }
}
