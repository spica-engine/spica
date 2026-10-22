import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ReturnDocument} from "@spica-server/database";
import {Id} from "@spica-server/interface-data";
import {ApiKey, ApiKeyRepository} from "@spica-server/interface-passport-apikey";

@Injectable()
export class MongoApiKeyRepository
  extends BaseCollection<ApiKey>("apikey")
  implements ApiKeyRepository
{
  constructor(db: DatabaseService) {
    super(db, {
      afterInit: () => this._coll.createIndex({key: 1}, {unique: true})
    });
  }

  findById(id: Id) {
    return this.findOne({_id: id});
  }

  findActiveByKey(key: string) {
    return this.findOne({key, active: true});
  }

  insert(apiKey: ApiKey) {
    return this.insertOne(apiKey);
  }

  updateById(id: Id, changes: Partial<ApiKey>) {
    return this.findOneAndUpdate(
      {_id: id},
      {$set: changes},
      {returnDocument: ReturnDocument.AFTER}
    );
  }

  replaceById(id: Id, apiKey: ApiKey) {
    return this.findOneAndReplace({_id: id}, apiKey, {returnDocument: ReturnDocument.AFTER});
  }

  deleteById(id: Id) {
    return this.deleteOne({_id: id});
  }

  addPolicy(id: Id, policyId: string) {
    return this.findOneAndUpdate(
      {_id: id},
      {$addToSet: {policies: policyId}},
      {returnDocument: ReturnDocument.AFTER}
    );
  }

  removePolicy(id: Id, policyId: string) {
    return this.findOneAndUpdate(
      {_id: id},
      {$pull: {policies: policyId}},
      {returnDocument: ReturnDocument.AFTER}
    );
  }

  removePolicyFromAll(policyId: string) {
    return this.updateMany({policies: {$in: [policyId]}}, {$pull: {policies: policyId}});
  }
}
