import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, MongoClient} from "@spica-server/database";
import {Observable} from "rxjs";
import {Webhook} from "./interface";

@Injectable()
export class WebhookService extends BaseCollection<Webhook>("webhook") {
  constructor(database: DatabaseService,client:MongoClient) {
    super(database,client);
  }

  targets(): Observable<TargetChange> {
    return new Observable(observer => {
      const emitHook = (hook: Webhook, kind: ChangeKind) => {
        const change: TargetChange = {
          kind: hook.trigger.active ? kind : ChangeKind.Removed,
          target: hook._id.toHexString()
        };
        if (change.kind != ChangeKind.Removed) {
          change.webhook = {
            title: hook.title,
            url: hook.url,
            body: hook.body,
            trigger: hook.trigger
          };
        }
        observer.next(change);
      };
      super.find().then(hooks => {
        for (const hook of hooks) {
          if (!hook.trigger.active) {
            continue;
          }
          emitHook(hook, ChangeKind.Added);
        }
      });

      const stream = this._coll.watch([], {
        fullDocument: "updateLookup"
      });
      stream.on("change", change => {
        switch (change.operationType) {
          case "replace":
          case "update":
            emitHook(change.fullDocument as Webhook, ChangeKind.Updated);
            break;
          case "insert":
            emitHook(change.fullDocument as Webhook, ChangeKind.Added);
            break;
          case "delete":
            observer.next({
              kind: ChangeKind.Removed,
              target: change.documentKey._id.toHexString()
            });
            break;
        }
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
  target: string;
  webhook?: Omit<Webhook, "_id">;
}
