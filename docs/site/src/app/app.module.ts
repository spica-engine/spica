import {HttpClientModule} from "@angular/common/http";
import {NgModule} from "@angular/core";
import {BrowserModule} from "@angular/platform-browser";
import {AppRoutingModule} from "./app-routing.module";
import {AppComponent} from "./app.component";
import {DocListComponent} from "./pages/doc-list/doc-list.component";
import {DocsComponent} from "./pages/docs/docs.component";

@NgModule({
  declarations: [AppComponent, DocsComponent, DocListComponent],
  imports: [BrowserModule, HttpClientModule, AppRoutingModule],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
