import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {Route, RouteCategory, RouteModule} from "@spica-client/core";
import {IdentityGuard, PolicyGuard} from "../passport";
import {AddComponent} from "./pages/add/add.component";
import {IndexComponent} from "./pages/index/index.component";
import {LogViewComponent} from "./pages/log-view/log-view.component";
import {TabsComponent} from "./pages/tabs/tabs.component";
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
      {path: "add", component: AddComponent, data: {action: "update"}},
      {
        canActivate: [FunctionIndexGuard],
        path: ":id",
        component: TabsComponent,
        children: [
          {pathMatch: "full", path: "", redirectTo: "code"},
          {path: "code", component: AddComponent},
          {path: "logs", component: LogViewComponent}
        ]
      }
    ]
  }
];

const route: Route[] = [
  {
    id: "function",
    category: RouteCategory.Developer,
    icon: "memory",
    path: "/function",
    display: "Function",
    data: {action: "function:index"}
  },
  {
    id: "subscription",
    category: RouteCategory.Developer,
    icon: "http",
    path: "/subscription",
    display: "Subscription",
    data: {action: "subscription:index"}
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule, RouteModule]
})
export class FunctionRoutingModule {}
