import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {Route, RouteCategory, RouteModule} from "@spica-client/core";
import {IdentityGuard, PolicyGuard} from "../passport";
import {AddComponent} from "./pages/add/add.component";
import {BucketAddComponent} from "./pages/bucket-add/bucket-add.component";
import {BucketIndexComponent} from "./pages/bucket-index/bucket-index.component";
import {ImportExportComponent} from "./pages/import-export/import-export.component";
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
          action: "update"
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
        path: "import-export",
        component: ImportExportComponent
      },
      {
        path: "settings",
        component: SettingsComponent
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
          action: "update"
        }
      },
      {
        path: ":id",
        component: BucketAddComponent,
        data: {
          action: "show"
        }
      }
    ]
  }
];

const route: Route[] = [
  {
    id: "bucket",
    category: RouteCategory.Developer,
    icon: "view_day",
    path: "/buckets",
    display: "Bucket",
    data: {
      action: "bucket:index"
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule]
})
export class BucketRoutingModule {}
