import {Injectable} from "@nestjs/common";
import {
  BaseCollection,
  Collection,
  DatabaseService,
  Filter,
  FindOneAndReplaceOptions,
  ObjectId,
  OptionalId,
  ReturnDocument,
  WithId
} from "@spica-server/database";
import {Preference} from "@spica-server/interface-preference";
import {Observable} from "rxjs";
import {deepCopy} from "@spica-server/core-patch";
import {PreferenceChangeDispatcher} from "./change-dispatcher.js";

@Injectable()
export class PreferenceService extends BaseCollection("preferences") {
  private _defaults = new Map<string, Preference>();

  constructor(
    db: DatabaseService,
    private readonly changeDispatcher: PreferenceChangeDispatcher
  ) {
    super(db, {afterInit: () => {}});
  }

  watchPreference<T extends Preference>(
    scope: string,
    {propagateOnStart}: {propagateOnStart: boolean} = {propagateOnStart: false}
  ): Observable<T> {
    return new Observable(observer => {
      // Serialize onto a single promise chain: each event reloads the document asynchronously,
      // so without this the initial value could arrive after a change, and two rapid updates
      // could emit out of order — leaving consumers compiling against a stale preference.
      let chain: Promise<unknown> = propagateOnStart
        ? this.get<T>(scope).then(pref => observer.next(pref))
        : Promise.resolve();

      const sub = this.changeDispatcher.watch().subscribe(change => {
        chain = chain.then(async () => {
          const preference = await this._coll.findOne<T>({_id: change.documentKey._id});
          if (preference && preference.scope === scope) {
            observer.next(preference);
          }
        });
      });
      return () => sub.unsubscribe();
    });
  }

  get<T extends Preference>(scope: string) {
    return this._coll
      .findOne<T>({scope})
      .then(preference => preference || deepCopy((this._defaults.get(scope) as T) || {}));
  }

  async replace<T extends Preference>(
    filter: Filter<Preference>,
    preference: T,
    options?: FindOneAndReplaceOptions
  ) {
    const result = await this._coll.findOneAndReplace(filter, preference, {
      returnDocument: ReturnDocument.AFTER,
      ...options
    });
    if (result) {
      this.changeDispatcher.dispatch({
        operationType: "replace",
        documentKey: {_id: result._id as ObjectId}
      });
    }
    return result;
  }

  async insertOne<T extends OptionalId<Preference>>(preference: T): Promise<WithId<Preference>> {
    const result = await this._coll.insertOne(preference);
    this.changeDispatcher.dispatch({
      operationType: "insert",
      documentKey: {_id: result.insertedId as ObjectId}
    });
    return {_id: result.insertedId, ...preference};
  }

  default<T extends Preference>(preference: T) {
    preference = deepCopy(preference);
    this._defaults.set(preference.scope, preference);
  }
}
