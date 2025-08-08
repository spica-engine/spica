import {Injectable, OnModuleDestroy} from "@nestjs/common";
import {ChangeStream, DatabaseService} from "../../../../../../libs/database";
import fetch from "node-fetch";
import {Webhook, ChangeKind} from "../../../../../../libs/interface/function/webhook";
import {WebhookLogService} from "./log.service";
import {WebhookService} from "./webhook.service";
import handlebars from "handlebars";
import {Subject, takeUntil} from "rxjs";

@Injectable()
export class WebhookInvoker implements OnModuleDestroy {
  private targets = new Map<string, ChangeStream>();
  private onDestroySubject = new Subject();

  constructor(
    private webhookService: WebhookService,
    private db: DatabaseService,
    private logService: WebhookLogService
  ) {
    this.webhookService
      .targets()
      .pipe(takeUntil(this.onDestroySubject))
      .subscribe(change => {
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
    handlebars.precompile(body, {strict: true});
  }

  private subscribe(target: string, {trigger, url, body}: Webhook) {
    /**
     * This is here to get backward-compatibility
     * @breaking-change 0.0.3 Remove this logic
     */
    if (body == undefined) {
      body = "{{{ toJSON this }}}";
    }
    const bodyTemplate = handlebars.compile(body, {strict: true});
    const stream = this.db.collection(trigger.options.collection).watch(
      [
        {
          $match: {operationType: trigger.options.type.toLowerCase()}
        }
      ],
      {fullDocument: "updateLookup"}
    );
    stream.on("change", (rawChange: any) => {
      const change = {
        type: rawChange.operationType,
        document: rawChange.fullDocument || rawChange.fullDocumentBeforeChange,
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
      return stream.close().then(() => this.targets.delete(target));
    }
  }

  onModuleDestroy() {
    this.onDestroySubject.next("");
    return Promise.all(Array.from(this.targets.keys()).map(key => this.unsubscribe(key)));
  }
}
