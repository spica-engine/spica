import {Inject, Injectable, Logger} from "@nestjs/common";
import {Id} from "@spica-server/interface-data";
import {Observable} from "rxjs";
import {
  Webhook,
  TargetChange,
  ChangeKind,
  WEBHOOK_REPOSITORY,
  WebhookRepository
} from "@spica-server/interface-function-webhook";
import {WebhookChangeDispatcher} from "./change-dispatcher.js";

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(WEBHOOK_REPOSITORY) private readonly webhooks: WebhookRepository,
    private readonly changeDispatcher: WebhookChangeDispatcher
  ) {}

  findById(id: Id) {
    return this.webhooks.findById(id);
  }

  async insert(webhook: Webhook): Promise<Webhook> {
    const result = await this.webhooks.insert(webhook);
    this.changeDispatcher.dispatch({operationType: "insert", documentKey: {_id: result._id}});
    return result;
  }

  async replaceById(id: Id, webhook: Webhook): Promise<Webhook | null> {
    const result = await this.webhooks.replaceById(id, webhook);
    if (result) {
      this.changeDispatcher.dispatch({operationType: "replace", documentKey: {_id: result._id}});
    }
    return result;
  }

  async deleteById(id: Id): Promise<Webhook | null> {
    const result = await this.webhooks.deleteById(id);
    if (result) {
      this.changeDispatcher.dispatch({operationType: "delete", documentKey: {_id: result._id}});
    }
    return result;
  }

  targets(): Observable<TargetChange> {
    return new Observable(observer => {
      const emitHook = (hook: Webhook, kind: ChangeKind) => {
        const change: TargetChange = {
          kind: hook.trigger.active ? kind : ChangeKind.Removed,
          target: hook._id.toString()
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
      const onFailure = (error: unknown) =>
        this.logger.error(
          `webhook target watch failed: ${error instanceof Error ? error.message : error}`
        );

      let chain: Promise<unknown> = this.webhooks
        .findAll()
        .then(hooks => {
          for (const hook of hooks) {
            if (!hook.trigger.active) {
              continue;
            }
            emitHook(hook, ChangeKind.Added);
          }
        })
        .catch(onFailure);

      // Serialize processing onto a single promise chain: each event reloads the document
      // asynchronously, so without this an insert's Added could be emitted after a later
      // delete's Removed, leaving the invoker with a dangling target stream.
      // Every link absorbs its own failure: a rejected chain would skip each later link, silently
      // stopping target registration for good since the invoker subscribes once per process.
      const sub = this.changeDispatcher.watch().subscribe(change => {
        chain = chain.then(async () => {
          try {
            const _id = change.documentKey._id;
            if (change.operationType === "delete") {
              observer.next({kind: ChangeKind.Removed, target: _id.toString()});
              return;
            }
            const hook = await this.webhooks.findById(_id);
            if (!hook) {
              observer.next({kind: ChangeKind.Removed, target: _id.toString()});
              return;
            }
            emitHook(
              hook,
              change.operationType === "insert" ? ChangeKind.Added : ChangeKind.Updated
            );
          } catch (error) {
            onFailure(error);
          }
        });
      });
      return () => sub.unsubscribe();
    });
  }
}
