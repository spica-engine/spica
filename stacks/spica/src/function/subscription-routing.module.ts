import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {Route, RouteCategory, RouteModule} from "@spica-client/core";
import {IdentityGuard, PolicyGuard} from "../passport";
import {SubscriptionAddComponent} from "./pages/subscription-add/subscription-add.component";
import {SubscriptionIndexComponent} from "./pages/subscription-index/subscription-index.component";

const routes: Routes = [
  {
    canActivate: [IdentityGuard, PolicyGuard],
    path: "subscription",
    data: {service: "subscription"},
    children: [
      {path: "", component: SubscriptionIndexComponent, data: {action: "index"}},
      {path: "add", component: SubscriptionAddComponent, data: {action: "create"}},
      {path: ":id", component: SubscriptionAddComponent, data: {action: "show"}}
    ]
  }
];

const route: Route[] = [
  {
    id: "subscription",
    category: RouteCategory.Developer,
    icon: "http",
    path: "/subscription",
    display: "Subscription",
    data: {action: "subscription:index"}
  }
];

@NgModule({
  imports: [RouteModule.forChild(route), RouterModule.forChild(routes)],
  exports: [RouterModule, RouterModule]
})
export class SubscriptionRoutingModule {}
