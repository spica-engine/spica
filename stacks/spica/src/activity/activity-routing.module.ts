import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {IndexComponent} from "@spica-client/activity/pages/index/index.component";
import {Route, RouteCategory, RouteModule} from "@spica-client/core";
import {IdentityGuard, PolicyGuard} from "@spica-client/passport";

const routes: Routes = [
  {
    path: "activity",
    canActivateChild: [IdentityGuard, PolicyGuard],
    component: IndexComponent,
    data: {
      service: "activity",
      action: "index"
    }
  }
];

const route: Route[] = [];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule]
})
export class ActivityRoutingModule {}
