import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {Route, RouteCategory, RouteModule} from "@spica-client/core";
import {ComposeComponent} from "./compose/compose.component";

const routes: Routes = [
  {path: "composer", component: ComposeComponent, data: {layout: false}, title: "Composer"}
];

const route: Route[] = [
  {
    id: "composer",
    category: RouteCategory.Developer,
    icon: "view_carousel",
    path: "/composer",
    display: "Composer"
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), RouteModule.forChild(route)],
  exports: [RouterModule]
})
export class ComposerRoutingModule {}
