import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {Route, RouteCategory, RouteModule} from "@spica-client/core";
import {IdentityGuard} from "./services/identity.guard";
import {IdentifyComponent} from "./pages/identify/identify.component";
import {IdentityAddComponent} from "./pages/identity-add/identity-add.component";
import {IdentityIndexComponent} from "./pages/identity-index/identity-index.component";
import {IdentitySettingsComponent} from "./pages/identity-settings/identity-settings.component";
import {PolicyAddComponent} from "./pages/policy-add/policy-add.component";
import {PolicyIndexComponent} from "./pages/policy-index/policy-index.component";
import {TabsComponent} from "./pages/tabs/tabs.component";
import {PolicyGuard} from "./services/policy.guard";
import {StrategiesComponent} from "./pages/strategies/strategies.component";
import {StrategiesAddComponent} from "./pages/strategies-add/strategies-add.component";

const routes: Routes = [
  {path: "passport/identify", component: IdentifyComponent, data: {layout: false}},
  {
    path: "passport",
    component: TabsComponent,
    canActivateChild: [IdentityGuard],
    children: [
      {
        path: "identity",
        canActivateChild: [PolicyGuard],
        data: {service: "passport:identity"},
        children: [
          {path: "", component: IdentityIndexComponent, data: {action: "index"}},
          {path: "add", component: IdentityAddComponent, data: {action: "update"}},
          {path: ":id/edit", component: IdentityAddComponent, data: {action: "show"}}
        ]
      },
      {
        path: "policy",
        canActivateChild: [PolicyGuard],
        data: {service: "passport:policy"},
        children: [
          {path: "", component: PolicyIndexComponent, data: {action: "index"}},
          {path: "add", component: PolicyAddComponent, data: {action: "update"}},
          {path: ":id/edit", component: PolicyAddComponent, data: {action: "show"}}
        ]
      },
      {
        path: "strategies",
        canActivateChild: [PolicyGuard],
        data: {service: "passport:strategy"},
        children: [
          {path: "", component: StrategiesComponent, data: {action: "index"}},
          {path: "add", component: StrategiesAddComponent, data: {action: "update"}},
          {path: ":id/edit", component: StrategiesAddComponent, data: {action: "show"}}
        ]
      },
      {path: "settings", component: IdentitySettingsComponent}
    ]
  }
];

const route: Route[] = [
  {
    id: "passport.identity",
    category: RouteCategory.System,
    display: "Identities",
    path: "/passport/identity",
    icon: "account_circle",
    data: {action: "passport:identity:index"}
  },
  {
    id: "passport.policy",
    category: RouteCategory.System,
    display: "Policies",
    path: "/passport/policy",
    icon: "layers",
    data: {action: "passport:policy:index"}
  },
  {
    id: "passport.strategy",
    category: RouteCategory.System,
    display: "Strategies",
    path: "/passport/strategies",
    icon: "linear_scale",
    data: {action: "passport:strategy:index"}
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule]
})
export class PassportRoutingModule {}
