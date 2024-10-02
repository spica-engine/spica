import {Injectable} from "@nestjs/common";
import {ChangeStream, DatabaseService} from "@spica-server/database";
import fetch from "node-fetch";
import {Webhook} from "./interface";
import {WebhookLogService} from "./log.service";
import {ChangeKind, WebhookService} from "./webhook.service";
import {compile, precompile} from "handlebars";

@Injectable()
export class WebhookInvoker {
  private targets = new Map<string, ChangeStream>();

  constructor(
    private webhookService: WebhookService,
    private db: DatabaseService,
    private logService: WebhookLogService
  ) {
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

  preCompile(body: string) {
    precompile(body, {strict: true});
  }

  private subscribe(target: string, {trigger, url, body}: Webhook) {
    /**
     * This is here to get backward-compatibility
     * @breaking-change 0.0.3 Remove this logic
     */
    if (body == undefined) {
      body = "{{{ toJSON this }}}";
    }
    const bodyTemplate = compile(body, {strict: true});
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

      let body;

      try {
        body = bodyTemplate(change, {
          allowProtoPropertiesByDefault: false,
          allowProtoMethodsByDefault: false,
          helpers: {
            toJSON: (object: unknown) => JSON.stringify(object)
          }
        });
      } catch (error) {
        this.logService.insertOne({
          succeed: false,
          content: {
            error: error.message
          },
          webhook: target,
          created_at: new Date()
        });
        return;
      }

      let request = {
        method: "post",
        body: body,
        headers: {
          "User-Agent": "Spica/Webhooks; (https://spicaengine.com/docs/guide/webhook)",
          "Content-type": "application/json"
        }
      };

      fetch(url, request)
        .then(async response => {
          return {
            headers: response.headers.raw(),
            status: response.status,
            statusText: response.statusText,
            body: await response.text()
          };
        })
        .then(response => {
          this.logService.insertOne({
            succeed: response.status < 400,
            content: {
              request: {body: request.body, headers: request.headers, url: url},
              response: response
            },
            webhook: target,
            created_at: new Date()
          });
        })
        .catch(() => {});
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
