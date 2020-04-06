import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {RouteModule, RouteCategory, Route} from "@spica-client/core";
import {IndexComponent} from "@spica-client/activity/pages/index/index.component";

const routes: Routes = [
  {
    path: "activity",
    component: IndexComponent
  }
];

const route: Route[] = [
  {
    id: "activity",
    category: RouteCategory.Activity,
    display: "User Activities",
    icon: "account_box",
    path: "/activity"
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule]
})
export class ActivityRoutingModule {}
