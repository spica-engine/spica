import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {Route, RouteCategory, RouteModule} from "@spica-client/core";
import {IdentityGuard, PolicyGuard} from "../passport";
import {ImageEditorComponent} from "./pages/image-editor/image-editor.component";
import {IndexComponent} from "./pages/index/index.component";

const routes: Routes = [
  {
    path: "storage",
    canActivateChild: [IdentityGuard, PolicyGuard],
    data: {service: "storage"},
    children: [
      {path: "", component: IndexComponent, data: {action: "index"}},
      {path: ":id", component: ImageEditorComponent, data: {action: "update"}}
    ]
  }
];
const route: Route[] = [
  {
    id: "storage",
    category: RouteCategory.Primary,
    display: "Storage",
    icon: "filter_drama",
    path: "/storage",
    data: {action: "storage:index"}
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule]
})
export class StorageRoutingModule {}
