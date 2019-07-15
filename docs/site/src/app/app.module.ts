import {HttpClientModule} from "@angular/common/http";
import {Injector, NgModule} from "@angular/core";
import {createCustomElement} from "@angular/elements";
import {FlexLayoutModule} from "@angular/flex-layout";
import {
  MatButtonModule,
  MatCardModule,
  MatGridListModule,
  MatIconModule,
  MatListModule,
  MatMenuModule,
  MatSidenavModule,
  MatToolbarModule
} from "@angular/material";
import {BrowserModule} from "@angular/platform-browser";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {ServiceWorkerModule} from "@angular/service-worker";
import {environment} from "../environments/environment";
import {AppRoutingModule} from "./app-routing.module";
import {AppComponent} from "./app.component";
import {FragmentLinkComponent} from "./components/fragment-link/fragment-link.component";
import {DocListComponent} from "./pages/doc-list/doc-list.component";
import {DocComponent} from "./pages/doc/doc.component";
import {DocsLayoutComponent} from "./pages/docs-layout/docs-layout.component";
import {DocsComponent} from "./pages/docs/docs.component";
import {HomeComponent} from "./pages/home/home.component";
import {TocComponent} from "./components/toc/toc.component";

@NgModule({
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    ServiceWorkerModule.register("ngsw-worker.js", {
      enabled: environment.production
    }),
    FlexLayoutModule,
    BrowserAnimationsModule,
    HttpClientModule,
    MatCardModule,
    MatToolbarModule,
    MatGridListModule,
    MatMenuModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatSidenavModule
  ],
  declarations: [
    AppComponent,
    HomeComponent,
    DocsComponent,
    DocListComponent,
    DocComponent,
    FragmentLinkComponent,
    DocsLayoutComponent,
    TocComponent
  ],
  entryComponents: [FragmentLinkComponent, TocComponent],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(injector: Injector) {
    customElements.define("fragment-link", createCustomElement(FragmentLinkComponent, {injector}));
    customElements.define("docs-table-of-contents", createCustomElement(TocComponent, {injector}));
  }
}
