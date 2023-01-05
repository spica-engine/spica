import {Component, NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {Route, RouteModule} from "@spica-client/core";
import {IdentityGuard, PolicyGuard} from "../passport";
import {IndexComponent} from "./pages/index/index.component";
import {WelcomeComponent} from "./pages/welcome/welcome.component";

const routes: Routes = [
  {
    path: "storage",
    canActivateChild: [IdentityGuard, PolicyGuard],
    data: {service: "storage"},
    children: [
      {path: "welcome", component: WelcomeComponent},
      {path: "add", component: IndexComponent, data: {action: "create"}},
      {path: ":name", component: IndexComponent, data: {action: "index"}}
    ]
  }
];
const route: Route[] = [];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule]
})
export class StorageRoutingModule {}
