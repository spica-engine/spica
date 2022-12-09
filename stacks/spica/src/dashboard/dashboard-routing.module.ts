import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {Route, RouteCategory, RouteModule} from "@spica-client/core";
import {IdentityGuard, PolicyGuard} from "../passport";
import {DashboardComponent} from "./pages/dashboard/dashboard.component";
import {DashboardViewComponent} from "./pages/dashboard-view/dashboard-view.component";
import {AddComponent} from "./pages/add/add.component";
import {IndexComponent} from "./pages/index/index.component";
import {WelcomeComponent} from "./pages/welcome/welcome.component";
import {DashboardIndexGuard} from "./dashboard.guard";
import {VersionControlComponent} from "./pages/versioncontrol/versioncontrol.component";

const routes: Routes = [
  {pathMatch: "full", path: "", redirectTo: "dashboard"},
  {
    path: "dashboard",
    canActivate: [IdentityGuard],
    component: DashboardComponent
  },
  {
    path: "dashboard/:id",
    canActivate: [IdentityGuard],
    component: DashboardViewComponent
  },
  {
    path: "dashboards",
    canActivate: [IdentityGuard],
    children: [
      {path: "welcome", component: WelcomeComponent},
      {
        path: "",
        canActivate: [DashboardIndexGuard],
        component: IndexComponent,
        data: {service: "dashboard", action: "index"}
      },
      {
        path: "add",
        canActivate: [PolicyGuard],
        component: AddComponent,
        data: {service: "dashboard", action: "create"}
      },
      {
        path: ":id",
        canActivate: [PolicyGuard],
        component: AddComponent,
        data: {service: "dashboard", action: "show"}
      }
    ]
  },
  {
    path: "versioncontrol",
    component: VersionControlComponent,
    canActivateChild: [IdentityGuard, PolicyGuard],
    data: {
      service: "versioncontrol",
      action: "update"
    }
  }
];

const route: Route[] = [
  {
    id: "list_all_dahsboards",
    category: RouteCategory.Dashboard_Sub,
    icon: "format_list_numbered",
    path: "/dashboards",
    display: "List"
  },
  {
    category: RouteCategory.Primary,
    icon: "shopping_cart",
    path: "assets",
    display: "Asset Store",
    id: "asset_store",
    index: 3
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule]
})
export class DashboardRoutingModule {}
