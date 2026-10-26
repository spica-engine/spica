import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ReturnDocument} from "@spica-server/database";
import {Id} from "@spica-server/interface-data";
import {Preference, PreferenceRepository} from "@spica-server/interface-preference";

@Injectable()
export class MongoPreferenceRepository
  extends BaseCollection<Preference>("preferences")
  implements PreferenceRepository
{
  constructor(db: DatabaseService) {
    super(db, {afterInit: () => {}});
  }

  findById(id: Id) {
    return this._coll.findOne({_id: id});
  }

  findByScope(scope: string) {
    return this._coll.findOne({scope});
  }

  async insert(preference: Preference) {
    const result = await this._coll.insertOne(preference);
    return {_id: result.insertedId, ...preference};
  }

  replaceByScope(scope: string, preference: Preference) {
    return this._coll.findOneAndReplace({scope}, preference, {
      returnDocument: ReturnDocument.AFTER,
      upsert: true
    });
  }
}
