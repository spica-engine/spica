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
import {FunctionService} from "./services/function.service";

@Injectable()
export class FunctionInitializer {
  constructor(
    private functionService: FunctionService,
    private webhookService: WebhookService,
    private routeService: RouteService,
    private passport: PassportService
  ) {
    webhookService.getWebhooks().subscribe(webhooks => {
      this.routeService.dispatch(new CherryPickAndRemove(e => e.category == RouteCategory.Webhook));
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

    functionService.getFunctions().subscribe(async funcs => {
      this.routeService.dispatch(
        new CherryPickAndRemove(e => e.category == RouteCategory.Developer)
      );
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Developer));

      for (const func of funcs) {
        const permissions = await Promise.all([
          this.passport.checkAllowed("function:show", func._id).toPromise(),
          this.passport.checkAllowed("function:index", func._id).toPromise()
        ]);
        if (permissions.every(p => p == true)) {
          this.routeService.dispatch(
            new Upsert({
              category: RouteCategory.Developer,
              id: func._id,
              icon: "memory",
              path: `/function/${func._id}`,
              display: func.name,
              resource_category: func.category
            })
          );
        }
      }
      this.routeService.dispatch(
        new Upsert({
          id: "add-function",
          category: RouteCategory.Developer,
          icon: "add",
          path: "/function/add",
          display: "Add New Function",
          data: {
            action: "function:create"
          },
          customClass: "dashed-item"
        })
      );
    });
  }

  async appInitializer() {
    if (!this.passport.identified) {
      return;
    }

    const [functionIndex, webhookIndex] = await Promise.all([
      this.passport.checkAllowed("function:index", "*").toPromise(),
      this.passport.checkAllowed("webhook:index", "*").toPromise()
    ]);

    if (!functionIndex && !webhookIndex) {
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Developer));
      return;
    }

    if (functionIndex) {
      this.functionService.loadFunctions().toPromise();
      this.webhookService.loadWebhooks().toPromise();
    }

    const [functionLog, webhookLog] = await Promise.all([
      functionIndex
        ? this.passport.checkAllowed("function:logs:index").toPromise()
        : Promise.resolve(false),
      webhookIndex
        ? this.passport.checkAllowed("webhook:logs:index").toPromise()
        : Promise.resolve(false)
    ]);

    if (!functionLog && !webhookLog) {
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Developer_Sub));
    } else if (!functionLog) {
      this.routeService.dispatch(new CherryPickAndRemove(e => e.id == "list_all_logs"));
    } else if (!webhookLog) {
      this.routeService.dispatch(new CherryPickAndRemove(e => e.id == "webhook_logs"));
    }
  }
}
