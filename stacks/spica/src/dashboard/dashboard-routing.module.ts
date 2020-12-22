import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {Route, RouteCategory, RouteModule} from "@spica-client/core";
import {IdentityGuard, PolicyGuard} from "../passport";
import {DashboardComponent} from "./pages/dashboard/dashboard.component";
import {DashboardViewComponent} from "./pages/dashboard-view/dashboard-view.component";
import {AddComponent} from "./pages/add/add.component";
import {IndexComponent} from "./pages/index/index.component";

const routes: Routes = [
  {pathMatch: "full", path: "", redirectTo: "dashboard"},
  {
    path: "dashboard",
    canActivate: [IdentityGuard, PolicyGuard],
    component: DashboardComponent
  },
  {
    path: "dashboard/:id",
    component: DashboardViewComponent,
    canActivate: [PolicyGuard]
  },
  {
    path: "dashboards",
    canActivate: [IdentityGuard, PolicyGuard],
    children: [
      {path: "", component: IndexComponent},
      {
        path: ":id",
        component: AddComponent
        //canActivate: [PolicyGuard]
        //data: {service: "dashboard", action: "update"}
      },
      {
        path: "add",
        component: AddComponent
        //canActivate: [PolicyGuard]
        //data: {service: "dashboard", action: "create"}
      }
    ]
  }
];

const route: Route[] = [
  {
    id: "dashboard",
    category: RouteCategory.Primary,
    icon: "dashboard",
    path: "/dashboard",
    display: "Dashboard"
  },
  {
    id: "list_all_dahsboards",
    category: RouteCategory.Primary,
    icon: "format_list_numbered",
    path: "/dashboards",
    display: "List Custom Dashboards"
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule]
})
export class DashboardRoutingModule {}
