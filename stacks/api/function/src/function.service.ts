import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Observable} from "rxjs";
import {Function, Environment, Triggers} from "./interface";

@Injectable()
export class FunctionService extends BaseCollection<Function>("function") {
  cachedTriggers: Map<string, Triggers> = new Map<string, Triggers>();
  constructor(database: DatabaseService) {
    super(database);
  }

  targets(): Observable<TargetChange> {
    return new Observable(observer => {
      const emitHandlers = (fn: Function, kind: ChangeKind) => {
        for (const handler in fn.triggers) {
          const trigger = fn.triggers[handler];
          observer.next({
            kind: trigger.active ? kind : ChangeKind.Removed,
            options: trigger.options,
            type: trigger.type,
            target: {
              id: fn._id.toString(),
              handler,
              context: {
                env: fn.env,
                timeout: fn.timeout
              }
            }
          });
        }
      };
      super.find().then(fns => {
        for (const fn of fns) {
          this.cachedTriggers.set(fn._id.toString(), fn.triggers);
          emitHandlers(fn, ChangeKind.Added);
        }
      });

      const stream = this._coll.watch([], {
        fullDocument: "updateLookup"
      });
      stream.on("change", change => {
        switch (change.operationType) {
          case "replace":
          case "update":
            let updatedChange = this.updateTriggers(change.fullDocument);
            emitHandlers(updatedChange, ChangeKind.Updated);
            break;
          case "insert":
            this.cachedTriggers.set(
              change.fullDocument._id.toString(),
              change.fullDocument.triggers
            );
            emitHandlers(change.fullDocument as Function, ChangeKind.Added);
            break;
          case "delete":
            this.cachedTriggers.delete(change.documentKey._id.toString());
            observer.next({
              kind: ChangeKind.Removed,
              target: {
                id: change.documentKey._id.toString()
              }
            });
            break;
        }
      });
      return () => {
        stream.close();
      };
    });
  }

  updateTriggers(fn: Function): Function {
    let oldTriggers = this.cachedTriggers.get(fn._id.toString());

    let newTriggers = fn.triggers;

    let addedHandlers = Object.keys(newTriggers).filter(
      handler => !Object.keys(oldTriggers).includes(handler)
    );

    for (const handler of addedHandlers) {
      oldTriggers[handler] = newTriggers[handler];
    }

    let removedHandlers = Object.keys(oldTriggers).filter(
      handler => !Object.keys(newTriggers).includes(handler)
    );

    for (const handler of removedHandlers) {
      fn.triggers[handler] = {
        ...oldTriggers[handler],
        active: false
      };
      delete oldTriggers[handler];
    }

    this.cachedTriggers.set(fn._id.toString(), oldTriggers);

    return fn;
  }
}

export enum ChangeKind {
  Added = 0,
  Removed = 1,
  Updated = 2
}

export interface Context {
  timeout: number;
  env: Environment;
}

export interface TargetChange {
  kind: ChangeKind;
  type?: string;
  options?: unknown;
  target: {
    id: string;
    handler?: string;
    context?: Context;
  };
}
