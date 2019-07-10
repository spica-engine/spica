import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {DocListComponent} from "./pages/doc-list/doc-list.component";
import {DocsComponent} from "./pages/docs/docs.component";

const routes: Routes = [
  {
    path: "docs",
    component: DocsComponent
  },
  {
    path: "docs/api/:name",
    component: DocListComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
