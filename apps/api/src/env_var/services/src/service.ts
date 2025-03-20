import {Injectable} from "@nestjs/common";
import {
  BaseCollection,
  ChangeStreamDocument,
  ChangeStreamOptions,
  DatabaseService
} from "@spica-server/database";
import {EnvVar} from "@spica-server/interface/env_var";
import {Observable} from "rxjs";

@Injectable()
export class EnvVarsService extends BaseCollection<EnvVar>("env_var") {
  constructor(db: DatabaseService) {
    super(db);
  }

  watch(
    pipeline?: object[],
    options?: ChangeStreamOptions
  ): Observable<ChangeStreamDocument<EnvVar>> {
    return new Observable(observer => {
      const stream = this._coll.watch(pipeline, options);
      stream.on("change", change => observer.next(change));
      stream.on("error", observer.error);

      return () => {
        if (!stream.closed) {
          stream.close();
        }
      };
    });
  }
}
