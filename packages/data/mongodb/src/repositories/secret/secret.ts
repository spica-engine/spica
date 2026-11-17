import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ReturnDocument} from "@spica-server/database";
import {Id} from "@spica-server/interface-data";
import {Secret, SecretRepository} from "@spica-server/interface-secret";
import {translateWriteError} from "../errors.js";

@Injectable()
export class MongoSecretRepository
  extends BaseCollection<Secret>("secret")
  implements SecretRepository
{
  constructor(db: DatabaseService) {
    super(db, {
      afterInit: () => this._coll.createIndex({key: 1}, {unique: true})
    });
  }

  findById(id: Id) {
    return this.findOne({_id: id});
  }

  insert(secret: Secret) {
    return this.insertOne(secret).catch(translateWriteError);
  }

  replaceById(id: Id, secret: Secret) {
    return this.findOneAndReplace({_id: id}, secret, {
      returnDocument: ReturnDocument.BEFORE
    }).catch(translateWriteError);
  }

  updateById(id: Id, fields: Partial<Secret>) {
    return this.findOneAndUpdate(
      {_id: id},
      {$set: fields},
      {returnDocument: ReturnDocument.BEFORE}
    ).catch(translateWriteError);
  }

  deleteById(id: Id) {
    return this.findOneAndDelete({_id: id});
  }
}
