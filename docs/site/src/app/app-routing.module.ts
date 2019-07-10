import {NgModule} from "@angular/core";
import {Routes, RouterModule} from "@angular/router";
import {DocComponent} from "./pages/doc/doc.component";

const routes: Routes = [
  {
    path: "docs",
    component: DocComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
