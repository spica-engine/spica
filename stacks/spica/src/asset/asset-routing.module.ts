import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {Route, RouteCategory, RouteModule} from "@spica-client/core";
import {IdentityGuard, PolicyGuard} from "../passport";
import {EditComponent} from "./pages/edit/edit.component";
import {IndexComponent} from "./pages/index/index.component";

const routes: Routes = [
  {
    path: "asset",
    canActivate: [IdentityGuard, PolicyGuard],
    component: IndexComponent,
    data: {service: "asset", action: "index"}
  },
  {
    path: "asset/:id",
    component: EditComponent,
    data: {
      action: "show"
    }
  }
];

const route: Route[] = [
  {
    id: "list_assets",
    category: RouteCategory.Asset_Sub,
    icon: "format_list_numbered",
    path: "/asset",
    display: "List"
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule]
})
export class AssetRoutingModule {}
