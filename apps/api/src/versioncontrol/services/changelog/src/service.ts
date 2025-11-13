import {Injectable} from "@nestjs/common";
import {
  BaseCollection,
  ChangeStreamDocument,
  ChangeStreamOptions,
  DatabaseService
} from "@spica-server/database";
import {Observable} from "rxjs";
import {ChangeLog} from "@spica-server/interface/versioncontrol";

@Injectable()
export class ChangeLogService extends BaseCollection<ChangeLog>("changelog") {
  constructor(db: DatabaseService) {
    super(db);
  }

  watch(
    pipeline?: object[],
    options?: ChangeStreamOptions
  ): Observable<ChangeStreamDocument<ChangeLog>> {
    return new Observable(observer => {
      const stream = this._coll.watch(pipeline, options);
      stream.on("change", change => observer.next(change));
      stream.on("error", console.error);

      return () => {
        if (!stream.closed) {
          stream.close();
        }
      };
    });
  }
}
