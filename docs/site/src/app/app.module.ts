import {HttpClientModule} from "@angular/common/http";
import {NgModule, Injector} from "@angular/core";
import {BrowserModule} from "@angular/platform-browser";
import {AppRoutingModule} from "./app-routing.module";
import {AppComponent} from "./app.component";
import {DocListComponent} from "./pages/doc-list/doc-list.component";
import {DocsComponent} from "./pages/docs/docs.component";
import {DocComponent} from "./pages/doc/doc.component";
import {CodeExampleComponent} from "./components/code-example/code-example.component";
import {createCustomElement} from "@angular/elements";

@NgModule({
  imports: [BrowserModule, HttpClientModule, AppRoutingModule],
  declarations: [AppComponent, DocsComponent, DocListComponent, DocComponent, CodeExampleComponent],
  entryComponents: [CodeExampleComponent],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(injector: Injector) {
    customElements.define("code-example", createCustomElement(CodeExampleComponent, {injector}));
  }
}
