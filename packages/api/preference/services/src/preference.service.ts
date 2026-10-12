import {Injectable, Logger} from "@nestjs/common";
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
  private readonly logger = new Logger(PreferenceService.name);
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
      const onFailure = (error: unknown) =>
        this.logger.error(
          `preference watch (${scope}) failed: ${error instanceof Error ? error.message : error}`
        );

      // Serialize onto a single promise chain: each event reloads the document asynchronously,
      // so without this the initial value could arrive after a change, and two rapid updates
      // could emit out of order — leaving consumers compiling against a stale preference.
      // Every link absorbs its own failure: a rejected chain would skip each later link, silently
      // stopping propagation for good since subscribers live as long as the process.
      let chain: Promise<unknown> = propagateOnStart
        ? this.get<T>(scope)
            .then(pref => observer.next(pref))
            .catch(onFailure)
        : Promise.resolve();

      const sub = this.changeDispatcher.watch().subscribe(change => {
        chain = chain.then(async () => {
          try {
            // `findOne` takes no generic in the contract; the collection's own type comes back.
            const preference = (await this.findOne({
              _id: change.documentKey._id
            })) as unknown as T;
            if (preference && preference.scope === scope) {
              observer.next(preference);
            }
          } catch (error) {
            onFailure(error);
          }
        });
      });
      return () => sub.unsubscribe();
    });
  }

  get<T extends Preference>(scope: string) {
    return this.findOne({scope}).then(
      preference => (preference as unknown as T) || deepCopy((this._defaults.get(scope) as T) || {})
    );
  }

  async replace<T extends Preference>(
    filter: Filter<Preference>,
    preference: T,
    options?: FindOneAndReplaceOptions
  ) {
    const result = await this.findOneAndReplace(filter, preference, {
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
    /**
     * `super`, NOT `this`: this method overrides `insertOne`, so `this.insertOne` would call itself. The
     * `_coll` sweep in Phase 6 turned `this._coll.insertOne(x)` into `this.insertOne(x)` and produced
     * exactly that recursion (`RangeError: Maximum call stack size exceeded`).
     */
    const inserted = await super.insertOne(preference);
    this.changeDispatcher.dispatch({
      operationType: "insert",
      documentKey: {_id: inserted._id as ObjectId}
    });
    // In the contract `insertOne` returns the inserted document, not Mongo's result object.
    // The cast is necessary: the base class gives the collection's own type and this override declares a
    // narrower one.
    return inserted as unknown as WithId<Preference>;
  }

  default<T extends Preference>(preference: T) {
    preference = deepCopy(preference);
    this._defaults.set(preference.scope, preference);
  }
}
