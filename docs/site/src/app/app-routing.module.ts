import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {DocListComponent} from "./pages/doc-list/doc-list.component";
import {DocComponent} from "./pages/doc/doc.component";
import {DocsLayoutComponent} from "./pages/docs-layout/docs-layout.component";
import {DocsComponent} from "./pages/docs/docs.component";
import {HomeComponent} from "./pages/home/home.component";
import {FeaturesComponent} from "./pages/features/features.component";
import {EnterpriseComponent} from "./pages/enterprise/enterprise.component";
import {PartnersComponent} from "./pages/partners/partners.component";
import {SupportPolicyComponent} from "./pages/support-policy/support-policy.component";
import {LimitPolicyComponent} from "./pages/limit-policy/limit-policy.component";
import {FairusagePolicyComponent} from "./pages/fairusage-policy/fairusage-policy.component";
import {CalendarComponent} from "./pages/calendar/calendar.component";

const routes: Routes = [
  {
    path: "",
    component: HomeComponent
  },
  {
    path: "docs",
    component: DocsLayoutComponent,
    children: [
      {
        pathMatch: "full",
        path: "",
        redirectTo: "guide/getting-started"
      },
      {
        path: "api/:apiName",
        component: DocListComponent
      },
      {
        path: "api/:apiName/:docName",
        component: DocComponent
      },
      {
        path: ":contentName/:docName",
        component: DocComponent
      },
      {
        path: ":contentName",
        component: DocComponent
      }
    ]
  },
  {
    path: "features",
    component: FeaturesComponent
  },
  {
    path: "pricing",
    component: EnterpriseComponent
  },
  {
    path: "partners",
    component: PartnersComponent
  },
  {
    path: "support-policy",
    component: SupportPolicyComponent
  },
  {
    path: "limit-policy",
    component: LimitPolicyComponent
  },
  {
    path: "fairusage-policy",
    component: FairusagePolicyComponent
  },
  {
    path: "calendar",
    component: CalendarComponent
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      anchorScrolling: "enabled",
      scrollPositionRestoration: "enabled"
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
