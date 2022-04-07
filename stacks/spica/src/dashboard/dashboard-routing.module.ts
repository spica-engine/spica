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
import {AssetStoreComponent} from "./pages/asset-store/asset-store.component";
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
  {path: "assets", component: AssetStoreComponent},
  {
    path: "versioncontrol",
    component: VersionControlComponent,
    canActivateChild: [IdentityGuard, PolicyGuard],
    data: {
      service: "versioncontrol",
      action: "show"
    }
  }
];

const route: Route[] = [
  {
    id: "dashboard",
    category: RouteCategory.Primary,
    icon: "dashboard",
    path: "/dashboard",
    display: "Dashboard",
    index: 0
  },
  {
    id: "list_all_dahsboards",
    category: RouteCategory.Primary_Sub,
    icon: "format_list_numbered",
    path: "/dashboards",
    display: "Custom Dashboards"
  },
  {
    category: RouteCategory.Primary,
    icon: "shopping_cart",
    path: "assets",
    display: "Asset Store",
    id: "asset_store",
    index: 3
  },
  {
    category: RouteCategory.Primary,
    icon: "account_tree",
    path: "versioncontrol",
    display: "Version Control",
    id: "versioncontrol",
    data: {action: "versioncontrol:update"},
    index: 4
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule]
})
export class DashboardRoutingModule {}
