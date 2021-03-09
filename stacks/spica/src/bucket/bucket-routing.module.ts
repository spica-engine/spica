import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {Route, RouteCategory, RouteModule} from "@spica-client/core";
import {IdentityGuard, PolicyGuard} from "../passport";
import {AddComponent} from "./pages/add/add.component";
import {BucketAddComponent} from "./pages/bucket-add/bucket-add.component";
import {BucketIndexComponent} from "./pages/bucket-index/bucket-index.component";
import {IndexComponent} from "./pages/index/index.component";
import {SettingsComponent} from "./pages/settings/settings.component";
import {WelcomeComponent} from "./pages/welcome/welcome.component";
import {BucketIndexGuard} from "./state/index.guard";
import {BucketCanDeactivate, BucketDataCanDeactivate} from "./state/deactivate.guard";

const routes: Routes = [
  {
    path: "bucket",
    canActivateChild: [IdentityGuard, PolicyGuard],
    data: {
      service: "bucket:data"
    },
    children: [
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
        },
        canDeactivate: [BucketDataCanDeactivate]
      },
      {
        path: ":id/:rid",
        component: AddComponent,
        data: {
          action: "show"
        },
        canDeactivate: [BucketDataCanDeactivate]
      }
    ]
  },
  {
    path: "buckets",
    canActivateChild: [IdentityGuard, PolicyGuard],
    data: {
      service: "bucket"
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
        canActivate: [BucketIndexGuard],
        path: "",
        component: BucketIndexComponent,
        data: {
          action: "index"
        }
      },
      {
        path: "add",
        component: BucketAddComponent,
        data: {
          action: "create"
        },
        canDeactivate: [BucketCanDeactivate]
      },
      {
        path: ":id",
        component: BucketAddComponent,
        data: {
          action: "show"
        },
        canDeactivate: [BucketCanDeactivate]
      }
    ]
  }
];

const route: Route[] = [
  {
    id: "bucket",
    category: RouteCategory.Content_Sub,
    icon: "view_day",
    path: "/buckets",
    display: "Buckets",
    data: {
      action: "bucket:index"
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule],
  providers: [BucketCanDeactivate, BucketDataCanDeactivate]
})
export class BucketRoutingModule {}
