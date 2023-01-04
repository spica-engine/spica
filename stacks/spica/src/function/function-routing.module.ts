import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {Route, RouteCategory, RouteModule} from "@spica-client/core";
import {IdentityGuard, PolicyGuard} from "../passport";
import {AddComponent} from "./pages/add/add.component";
import {IndexComponent} from "./pages/index/index.component";
import {LogViewComponent} from "./pages/log-view/log-view.component";
import {WelcomeComponent} from "./pages/welcome/welcome.component";
import {FunctionIndexGuard} from "./resolvers/function.guard";
import {FunctionCanDeactivate} from "./resolvers/deactivate.guard";

const routes: Routes = [
  {
    path: "function",
    canActivateChild: [IdentityGuard, PolicyGuard],
    data: {service: "function"},
    children: [
      {path: "welcome", component: WelcomeComponent},
      {
        canActivate: [FunctionIndexGuard],
        path: "",
        component: IndexComponent,
        data: {action: "index"}
      },
      {
        canActivate: [FunctionIndexGuard],
        path: "logs",
        component: LogViewComponent,
        data: {service: "function:logs", action: "index"}
      },
      {
        canActivate: [FunctionIndexGuard],
        path: ":id",
        component: AddComponent,
        data: {action: "show"},
        canDeactivate: [FunctionCanDeactivate]
      }
    ]
  }
];

const route: Route[] = [
  {
    id: "webhook_list",
    category: RouteCategory.Webhook_Sub,
    icon: "format_list_numbered",
    path: "/webhook",
    display: "List",
    data: {action: "webhook:index"}
  },
  {
    id: "webhook_logs",
    category: RouteCategory.Webhook_Sub,
    icon: "pest_control",
    path: "/webhook/logs",
    display: "Logs",
    data: {action: "webhook:logs:index"}
  },
  {
    category: RouteCategory.Developer_Sub,
    id: `list_all_logs`,
    icon: "pest_control",
    path: "/function/logs",
    display: "Logs",
    queryParams: {
      begin: new Date(new Date().setHours(0, 0, 0, 0)),
      end: new Date(new Date().setHours(23, 59, 59, 999)),
      showErrors: true
    },
    data: {action: "function:logs:index"}
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule],
  providers: [FunctionCanDeactivate]
})
export class FunctionRoutingModule {}
