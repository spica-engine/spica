import {Injectable} from "@nestjs/common";
import {Collection, DatabaseService} from "@spica-server/database";
import {Preference} from "./interface";
import {Observable} from "rxjs";

@Injectable()
export class PreferenceService {
  private _collection: Collection<Preference>;
  private _defaults = new Map<string, Preference>();

  constructor(database: DatabaseService) {
    this._collection = database.collection("preferences");
  }

  watch<T extends Preference>(
    scope: string,
    {propagateOnStart}: {propagateOnStart: boolean} = {propagateOnStart: false}
  ): Observable<T> {
    return new Observable(observer => {
      if (propagateOnStart) {
        this.get<T>(scope).then(pref => observer.next(pref));
      }

      const watcher = this._collection.watch([
        {
          $match: {
            "fullDocument.scope": scope
          }
        }
      ]);

      watcher.on("change", change => observer.next(change.fullDocument as T));
      return () => {
        if (!watcher.isClosed()) {
          watcher.close();
        }
      };
    });
  }

  get<T extends Preference>(scope: string) {
    return this._collection
      .findOne<T>({scope})
      .then(preference => preference || (this._defaults.get(scope) as T));
  }

  update<T extends Preference>(preference: T) {
    delete preference._id;
    return this._collection.findOneAndReplace({scope: preference.scope}, preference, {
      upsert: true
    });
  }

  default<T extends Preference>(preference: T) {
    this._defaults.set(preference.scope, preference);
  }
}
