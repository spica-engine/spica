import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ReturnDocument} from "@spica-server/database";
import {Id} from "@spica-server/interface-data";
import {EnvVar, EnvVarRepository} from "@spica-server/interface-env_var";
import {translateWriteError} from "../errors.js";

@Injectable()
export class MongoEnvVarRepository
  extends BaseCollection<EnvVar>("env_var")
  implements EnvVarRepository
{
  constructor(db: DatabaseService) {
    super(db, {
      afterInit: () => this._coll.createIndex({key: 1}, {unique: true})
    });
  }

  findById(id: Id) {
    return this.findOne({_id: id});
  }

  insert(envVar: EnvVar) {
    return this.insertOne(envVar).catch(translateWriteError);
  }

  replaceById(id: Id, envVar: EnvVar) {
    return this.findOneAndReplace({_id: id}, envVar, {
      returnDocument: ReturnDocument.AFTER
    }).catch(translateWriteError);
  }

  updateById(id: Id, fields: Partial<EnvVar>) {
    return this.findOneAndUpdate(
      {_id: id},
      {$set: fields},
      {returnDocument: ReturnDocument.AFTER}
    ).catch(translateWriteError);
  }

  deleteById(id: Id) {
    return this.findOneAndDelete({_id: id});
  }
}
