import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {EnvVar} from "@spica-server/interface/env_var";
import {Observable} from "rxjs";

@Injectable()
export class EnvVarsService extends BaseCollection<EnvVar>("env_var") {
  constructor(db: DatabaseService) {
    super(db);
  }

  watch(): Observable<EnvVar> {
    return new Observable(observer => {
      const stream = this._coll.watch(
        [
          {
            $match: {
              operationType: {
                $in: ["delete", "replace", "update"]
              }
            }
          }
        ],
        {
          fullDocument: "updateLookup"
        }
      );
      stream.on("change", change => {
        switch (change.operationType) {
          case "update":
            observer.next(change.fullDocument);
            break;
          case "replace":
            observer.next(change.fullDocument);
            break;
          case "delete":
            // handle delete differently
            observer.next(change.fullDocumentBeforeChange);
            break;
          default:
            observer.error(`Unknown operation type(${change.operationType}) received.`);
            break;
        }
      });
      return () => {
        if (!stream.closed) {
          stream.close();
        }
      };
    });
  }
}
