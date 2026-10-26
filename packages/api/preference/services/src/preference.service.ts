import {Inject, Injectable, Logger} from "@nestjs/common";
import {
  Preference,
  PREFERENCE_REPOSITORY,
  PreferenceRepository
} from "@spica-server/interface-preference";
import {Observable} from "rxjs";
import {deepCopy} from "@spica-server/core-patch";
import {PreferenceChangeDispatcher} from "./change-dispatcher.js";

@Injectable()
export class PreferenceService {
  private readonly logger = new Logger(PreferenceService.name);
  private _defaults = new Map<string, Preference>();

  constructor(
    @Inject(PREFERENCE_REPOSITORY) private readonly preferences: PreferenceRepository,
    private readonly changeDispatcher: PreferenceChangeDispatcher
  ) {}

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
            const preference = (await this.preferences.findById(change.documentKey._id)) as T;
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
    return this.preferences
      .findByScope(scope)
      .then(preference => (preference as T) || deepCopy((this._defaults.get(scope) as T) || {}));
  }

  async replace<T extends Preference>(scope: string, preference: T) {
    const result = await this.preferences.replaceByScope(scope, preference);
    if (result) {
      this.changeDispatcher.dispatch({
        operationType: "replace",
        documentKey: {_id: result._id}
      });
    }
    return result;
  }

  async insert<T extends Preference>(preference: T): Promise<Preference> {
    const result = await this.preferences.insert(preference);
    this.changeDispatcher.dispatch({
      operationType: "insert",
      documentKey: {_id: result._id}
    });
    return result;
  }

  default<T extends Preference>(preference: T) {
    preference = deepCopy(preference);
    this._defaults.set(preference.scope, preference);
  }
}
