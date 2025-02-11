import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {IdentityGuard, PolicyGuard} from "../passport";
import {WebhookAddComponent} from "./pages/webhook-add/webhook-add.component";
import {WebhookIndexComponent} from "./pages/webhook-index/webhook-index.component";
import {WebhookLogViewComponent} from "./pages/webhook-log-view/webhook-log-view.component";
import {WebhookWelcomeComponent} from "./pages/webhook-welcome/webhook-welcome.component";
import {WebhookGuard} from "./resolvers/webhook.guard";

const routes: Routes = [
  {
    canActivate: [IdentityGuard, PolicyGuard],
    path: "webhook/logs",
    data: {service: "webhook"},
    children: [{path: "", component: WebhookLogViewComponent, data: {action: "index"}}],
    title: "WebhookLogs"
  },
  {
    canActivate: [IdentityGuard, PolicyGuard],
    path: "webhook",
    data: {service: "webhook"},
    children: [
      {path: "welcome", component: WebhookWelcomeComponent, data: {action: ""}},
      {
        path: "",
        component: WebhookIndexComponent,
        canActivate: [WebhookGuard],
        data: {action: "index"}
      },
      {
        path: "add",
        component: WebhookAddComponent,
        data: {action: "create"}
      },
      {
        path: ":id",
        component: WebhookAddComponent,
        data: {action: "show"}
      }
    ],
    title: "Webhook"
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class WebhookRoutingModule {}
