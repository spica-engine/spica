import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {Route, RouteCategory, RouteModule} from "@spica-client/core";
import {IdentityGuard, PolicyGuard} from "../passport";
import {AddComponent} from "./pages/add/add.component";
import {BucketActionsComponent} from "./pages/bucket-actions/bucket-actions.component";
import {IndexComponent} from "./pages/index/index.component";
import {SettingsComponent} from "./pages/settings/settings.component";
import {WelcomeComponent} from "./pages/welcome/welcome.component";
import {BucketIndexGuard} from "./state/index.guard";

const routes: Routes = [
  {
    path: "bucket",
    canActivateChild: [IdentityGuard, PolicyGuard],
    data: {
      service: "bucket:data"
    },
    children: [
      {
        path: "welcome",
        component: WelcomeComponent
      },
      {
        path: "settings",
        component: SettingsComponent,
        data: {
          service: "preference",
          action: "show",
          params: {
            scope: "bucket"
          }
        }
      },
      {
        path: ":id",
        component: IndexComponent,
        data: {
          action: "index"
        }
      },
      {
        path: ":id/add",
        component: AddComponent,
        data: {
          action: "create"
        }
      },
      {
        path: ":id/:rid",
        component: AddComponent,
        data: {
          action: "show"
        }
      }
    ]
  }
];

const route: Route[] = [
  {
    id: "bucket-settings",
    category: RouteCategory.Content_Sub,
    icon: "settings",
    path: "/bucket/settings",
    display: "Settings",
    data: {
      action: "preference:show"
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule]
})
export class BucketRoutingModule {}
