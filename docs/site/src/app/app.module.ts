import {HttpClientModule} from "@angular/common/http";
import {Injector, NgModule} from "@angular/core";
import {createCustomElement} from "@angular/elements";
import {BrowserModule} from "@angular/platform-browser";
import {ServiceWorkerModule} from "@angular/service-worker";
import {environment} from "../environments/environment";
import {AppRoutingModule} from "./app-routing.module";
import {AppComponent} from "./app.component";
import {FragmentLinkComponent} from "./components/fragment-link/fragment-link.component";
import {DocListComponent} from "./pages/doc-list/doc-list.component";
import {DocComponent} from "./pages/doc/doc.component";
import {DocsComponent} from "./pages/docs/docs.component";

@NgModule({
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    ServiceWorkerModule.register("ngsw-worker.js", {enabled: environment.production})
  ],
  declarations: [
    AppComponent,
    DocsComponent,
    DocListComponent,
    DocComponent,
    FragmentLinkComponent
  ],
  entryComponents: [FragmentLinkComponent],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(injector: Injector) {
    customElements.define("fragment-link", createCustomElement(FragmentLinkComponent, {injector}));
  }
}
