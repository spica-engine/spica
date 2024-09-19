import {Injectable} from "@nestjs/common";
import {
  BaseCollection,
  DatabaseService,
  Filter,
  FindOneAndReplaceOptions,
  OptionalId,
  WithId
} from "@spica-server/database";
import {Preference} from "./interface";
import {Observable} from "rxjs";

@Injectable()
export class PreferenceService extends BaseCollection("preferences") {
  private _defaults = new Map<string, Preference>();

  constructor(db: DatabaseService) {
    super(db, {afterInit: () => {}});
  }

  watch<T extends Preference>(
    scope: string,
    {propagateOnStart}: {propagateOnStart: boolean} = {propagateOnStart: false}
  ): Observable<T> {
    return new Observable(observer => {
      if (propagateOnStart) {
        this.get<T>(scope).then(pref => observer.next(pref));
      }

      const watcher = this._coll.watch(
        [
          {
            $match: {
              "fullDocument.scope": {$eq: scope}
            }
          }
        ],
        {fullDocument: "updateLookup"}
      );
      watcher["on"]("change", change => {
        if ("fullDocument" in change) {
          observer.next(change.fullDocument as T);
        }
      });
      return () => {
        if (!watcher.closed) {
          watcher.close();
        }
      };
    });
  }

  get<T extends Preference>(scope: string) {
    return this._coll
      .findOne<T>({scope})
      .then(preference => preference || (this._defaults.get(scope) as T));
  }

  replace<T extends Preference>(
    filter: Filter<Preference>,
    preference: T,
    options?: FindOneAndReplaceOptions
  ) {
    return this._coll.findOneAndReplace(filter, preference, options);
  }

  insertOne<T extends OptionalId<Preference>>(preference: T): Promise<WithId<Preference>> {
    return this._coll.insertOne(preference).then(r => {
      preference._id = r.insertedId;
      return preference as WithId<Preference>;
    });
  }

  default<T extends Preference>(preference: T) {
    this._defaults.set(preference.scope, preference);
  }
}
