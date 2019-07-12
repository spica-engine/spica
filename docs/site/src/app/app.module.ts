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
import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from '../environments/environment';

@NgModule({
  imports: [BrowserModule, HttpClientModule, AppRoutingModule, ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production })],
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
