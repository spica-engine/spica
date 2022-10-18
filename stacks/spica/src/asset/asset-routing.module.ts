import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {Route, RouteCategory, RouteModule} from "@spica-client/core";
import {AddComponent} from "./pages/add/add.component";
import {AssetComponent} from "./pages/asset/asset.component";
import {IndexComponent} from "./pages/index/index.component";

const routes: Routes = [
  {
    path: "assets",
    children: [
      {
        path: "",
        component: IndexComponent
      },
      {
        path: "add",
        component: AddComponent
      },
      {
        path: ":package",
        component: AssetComponent
      }
    ]
  }
];

const route: Route[] = [
  {
    category: RouteCategory.Asset_Sub,
    icon: "format_list_numbered",
    path: "/assets",
    display: "List",
    id: "asset_store_list",
    index: 0
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule]
})
export class AssetRoutingModule {}
