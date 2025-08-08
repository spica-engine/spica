import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "../../../../../../libs/database";
import {Observable} from "rxjs";
import {Webhook, TargetChange, ChangeKind} from "../../../../../../libs/interface/function/webhook";

@Injectable()
export class WebhookService extends BaseCollection<Webhook>("webhook") {
  constructor(database: DatabaseService) {
    super(database);
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
