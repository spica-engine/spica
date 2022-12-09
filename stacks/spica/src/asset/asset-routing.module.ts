import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {Route, RouteCategory, RouteModule} from "@spica-client/core";
import {IdentityGuard, PolicyGuard} from "../passport";
import {EditComponent} from "./pages/edit/edit.component";
import {IndexComponent} from "./pages/index/index.component";
import {AssetStoreComponent} from "./pages/asset-store/asset-store.component";

const routes: Routes = [
  {path: "assetstore", component: AssetStoreComponent},
  {
    path: "assets",
    canActivate: [IdentityGuard, PolicyGuard],
    component: IndexComponent,
    data: {service: "asset", action: "index"}
  },
  {
    path: "assets/:id",
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
    path: "/assets",
    display: "List"
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule]
})
export class AssetRoutingModule {}
