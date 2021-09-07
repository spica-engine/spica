import {Inject, Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Observable} from "rxjs";
import {Function} from "./interface";
import {FunctionOptions, FUNCTION_OPTIONS} from "./options";

@Injectable()
export class FunctionService extends BaseCollection<Function>("function") {
  constructor(database: DatabaseService, @Inject(FUNCTION_OPTIONS) options: FunctionOptions) {
    super(database, {entryLimit: options.entryLimit});
  }

  watch(initialMessage?: boolean) {
    return new Observable<number>(observer => {
      const stream = this._coll.watch([
        {
          $match: {
            $or: [{operationType: "insert"}, {operationType: "delete"}]
          }
        }
      ]);

      stream.on("change", () => {
        this._coll.estimatedDocumentCount().then(count => observer.next(count));
      });

      if (initialMessage) {
        this._coll.estimatedDocumentCount().then(count => observer.next(count));
      }

      return () => stream.close();
    });
  }
}
