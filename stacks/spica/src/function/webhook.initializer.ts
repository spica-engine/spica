import {Injectable} from "@angular/core";
import {
  Add,
  CherryPickAndRemove,
  RemoveCategory,
  RouteCategory,
  RouteService,
  Upsert
} from "@spica-client/core/route";
import {PassportService} from "@spica-client/passport";
import {WebhookService} from "./services/webhook.service";

@Injectable()
export class WebhookInitializer {
  constructor(
    private webhookService: WebhookService,
    private routeService: RouteService,
    private passport: PassportService
  ) {
    webhookService.getWebhooks().subscribe(webhooks => {
      this.routeService.dispatch(
        new CherryPickAndRemove(e => e.icon == "webhook" && /\/webhook\//.test(e.path))
      );
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Webhook));

      for (const webhook of webhooks) {
        this.routeService.dispatch(
          new Upsert({
            category: RouteCategory.Webhook,
            id: webhook._id,
            icon: "webhook",
            path: `/webhook/${webhook._id}`,
            display: webhook.title
          })
        );
      }

      this.routeService.dispatch(
        new Upsert({
          id: "add-webhook",
          category: RouteCategory.Webhook,
          icon: "add",
          path: "/webhook/add",
          display: "Add New Webhook",
          customClass: "dashed-item"
        })
      );
    });
  }

  async appInitializer() {
    if (!this.passport.identified) {
      return;
    }

    const webhookIndex = await this.passport.checkAllowed("webhook:index", "*").toPromise();

    if (!webhookIndex) {
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Webhook));
      return;
    }

    this.webhookService.loadWebhooks().toPromise();

    const webhookLog = (await webhookIndex)
      ? this.passport.checkAllowed("webhook:logs:index").toPromise()
      : Promise.resolve(false);

    if (!webhookLog) {
      this.routeService.dispatch(new CherryPickAndRemove(e => e.id == "webhook_logs"));
    }
  }
}
