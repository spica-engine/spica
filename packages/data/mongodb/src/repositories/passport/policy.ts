import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Id} from "@spica-server/interface-data";
import {Policy, PolicyRepository} from "@spica-server/interface-passport-policy";

@Injectable()
export class MongoPolicyRepository
  extends BaseCollection<Policy>("policies")
  implements PolicyRepository
{
  constructor(db: DatabaseService) {
    super(db);
  }

  findAll() {
    return this._coll.find().toArray();
  }

  findById(id: Id) {
    return this.findOne({_id: id});
  }

  insert(policy: Policy) {
    return this.insertOne(policy);
  }

  replaceById(id: Id, policy: Policy) {
    return this.replaceOne({_id: id}, policy);
  }

  deleteById(id: Id) {
    return this.deleteOne({_id: id});
  }
}
