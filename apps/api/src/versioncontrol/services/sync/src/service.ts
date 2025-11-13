import {Injectable} from "@nestjs/common";
import {
  BaseCollection,
  ChangeStreamDocument,
  ChangeStreamOptions,
  DatabaseService
} from "@spica-server/database";
import {Observable} from "rxjs";
import {Sync} from "@spica-server/interface/versioncontrol";

@Injectable()
export class SyncService extends BaseCollection<Sync>("sync") {
  constructor(db: DatabaseService) {
    super(db);
  }

  watch(
    pipeline?: object[],
    options?: ChangeStreamOptions
  ): Observable<ChangeStreamDocument<Sync>> {
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
