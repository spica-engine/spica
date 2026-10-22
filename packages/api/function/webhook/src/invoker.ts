import {Inject, Injectable, OnModuleDestroy} from "@nestjs/common";
import fetch from "node-fetch";
import {
  Webhook,
  ChangeKind,
  WEBHOOK_LOG_REPOSITORY,
  WebhookLogRepository
} from "@spica-server/interface-function-webhook";
import {WebhookService} from "./webhook.service.js";
import handlebars from "handlebars";
import {Subject, Subscription, takeUntil} from "rxjs";
import {CHANGE_FEED, ChangeFeed, ChangeOperation} from "@spica-server/interface-data";

@Injectable()
export class WebhookInvoker implements OnModuleDestroy {
  private targets = new Map<string, Subscription>();
  private onDestroySubject = new Subject();

  constructor(
    private webhookService: WebhookService,
    @Inject(CHANGE_FEED) private feed: ChangeFeed,
    @Inject(WEBHOOK_LOG_REPOSITORY) private logs: WebhookLogRepository
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
    const subscription = this.feed
      .watch(trigger.options.collection, {
        operations: [trigger.options.type.toLowerCase() as ChangeOperation],
        document: "current"
      })
      .subscribe((rawChange: any) => {
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
          this.logs.insert({
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
            this.logs.insert({
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

    this.targets.set(target, subscription);
  }

  private unsubscribe(target: string) {
    const subscription = this.targets.get(target);
    if (subscription) {
      subscription.unsubscribe();
      this.targets.delete(target);
    }
  }

  onModuleDestroy() {
    this.onDestroySubject.next("");
    return Promise.all(Array.from(this.targets.keys()).map(key => this.unsubscribe(key)));
  }
}
