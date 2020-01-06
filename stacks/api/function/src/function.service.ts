import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Observable} from "rxjs";
import {Function} from "./interface";

@Injectable()
export class FunctionService extends BaseCollection<Function>("function") {
  constructor(database: DatabaseService) {
    super(database);
  }

  targets(): Observable<TargetChange> {
    return new Observable(observer => {
      super.find().then(fns => {
        for (const fn of fns) {
          for (const handler in fn.triggers) {
            const trigger = fn.triggers[handler];
            if (!trigger.active) {
              continue;
            }
            observer.next({
              kind: ChangeKind.Added,
              options: trigger.options,
              type: trigger.type,
              target: {
                id: fn._id.toString(),

                handler
              }
            });
          }
        }
      });
      const stream = this._coll.watch([], {
        fullDocument: "updateLookup"
      });
      stream.on("change", change => {
        console.log(change);
      });
      return () => {
        stream.close();
      };
    });
  }
}

export enum ChangeKind {
  Added = 0,
  Removed = 1,
  Updated = 2
}

export interface TargetChange {
  kind: ChangeKind;
  type?: string;
  options?: unknown;
  target: {
    id: string;
    handler?: string;
  };
}
