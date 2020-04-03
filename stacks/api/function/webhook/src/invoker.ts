import {Injectable} from "@nestjs/common";
import {ChangeStream, DatabaseService} from "@spica-server/database";
import fetch from "node-fetch";
import {Webhook} from "./interface";
import {ChangeKind, WebhookService} from "./webhook.service";

@Injectable()
export class WebhookInvoker {
  private targets = new Map<string, ChangeStream>();

  constructor(private webhookService: WebhookService, private db: DatabaseService) {
    this.webhookService.targets().subscribe(change => {
      switch (change.kind) {
        case ChangeKind.Added:
          this.subscribe(change.target, change.webhook);
          break;
        case ChangeKind.Updated:
          this.unsubscribe(change.target);
          this.subscribe(change.target, change.webhook);
          break;
        case ChangeKind.Removed:
          this.unsubscribe(change.target);
          break;
      }
    });
  }

  private subscribe(target: string, {trigger, url}: Webhook) {
    const stream = this.db.collection(trigger.options.collection).watch(
      [
        {
          $match: {operationType: trigger.options.type.toLowerCase()}
        }
      ],
      {fullDocument: "updateLookup"}
    );
    stream.on("change", rawChange => {
      const change = {
        type: rawChange.operationType,
        document: rawChange.fullDocument,
        documentKey: rawChange.documentKey._id.toString()
      };
      fetch(url, {
        method: "post",
        body: JSON.stringify(change),
        headers: {
          "User-Agent": "Spica/Webhooks; (https://spicaengine.com/docs/guide/subscription)",
          "Content-type": "application/json"
        }
      }).catch(() => {});
    });
    this.targets.set(target, stream);
  }

  private unsubscribe(target: string) {
    const stream = this.targets.get(target);
    if (stream) {
      stream.close();
      this.targets.delete(target);
    }
  }
}
