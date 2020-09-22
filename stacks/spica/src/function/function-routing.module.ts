import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {Route, RouteCategory, RouteModule} from "@spica-client/core";
import {IdentityGuard, PolicyGuard} from "../passport";
import {AddComponent} from "./pages/add/add.component";
import {IndexComponent} from "./pages/index/index.component";
import {LogViewComponent} from "./pages/log-view/log-view.component";
import {WelcomeComponent} from "./pages/welcome/welcome.component";
import {FunctionIndexGuard} from "./resolvers/function.guard";

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
      {path: "add", component: AddComponent, data: {action: "create"}},
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
        data: {action: "show"}
      }
    ]
  }
];

const route: Route[] = [
  {
    id: "webhook",
    category: RouteCategory.Developer,
    icon: "http",
    path: "/webhook",
    display: "Webhooks",
    data: {action: "webhook:index"}
  },
  {
    id: "webhook_logs",
    category: RouteCategory.Developer,
    icon: "pest_control",
    path: "/webhook/logs",
    display: "Webhook Logs",
    data: {action: "webhook:logs:index"}
  },
  {
    category: RouteCategory.Function,
    id: `list_all_functions`,
    icon: "format_list_numbered",
    path: `/function`,
    display: "Functions"
  },
  {
    category: RouteCategory.Function,
    id: `list_all_logs`,
    icon: "pest_control",
    path: "/function/logs",
    display: "Logs",
    queryParams: {
      begin: new Date(new Date().setHours(0, 0, 0, 0)),
      end: new Date(new Date().setHours(23, 59, 59, 999)),
      showErrors: true
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule]
})
export class FunctionRoutingModule {}
