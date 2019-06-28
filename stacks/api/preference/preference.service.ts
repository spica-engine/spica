import {Injectable} from "@nestjs/common";
import {Collection, DatabaseService} from "@spica-server/database";
import {Preference} from "./interface";

@Injectable()
export class PreferenceService {
  private _collection: Collection<Preference>;
  private _defaults = new Map<string, Preference>();

  constructor(database: DatabaseService) {
    this._collection = database.collection("preferences");
  }

  get<T extends Preference>(scope: string) {
    return this._collection
      .findOne<T>({scope})
      .then(preference => preference || (this._defaults.get(scope) as T));
  }

  update<T extends Preference>(preference: T) {
    delete preference._id;
    return this._collection.findOneAndUpdate(
      {scope: preference.scope},
      {$set: preference},
      {upsert: true}
    );
  }

  default<T extends Preference>(preference: T) {
    this._defaults.set(preference.scope, preference);
  }
}
