import {HttpClientModule} from "@angular/common/http";
import {Injector, NgModule} from "@angular/core";
import {createCustomElement} from "@angular/elements";
import {FlexLayoutModule} from "@angular/flex-layout";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatOptionModule} from "@angular/material/core";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatGridListModule} from "@angular/material/grid-list";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatListModule} from "@angular/material/list";
import {MatMenuModule} from "@angular/material/menu";
import {MatSelectModule} from "@angular/material/select";
import {MatSidenavModule} from "@angular/material/sidenav";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {BrowserModule} from "@angular/platform-browser";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {ServiceWorkerModule} from "@angular/service-worker";
import {environment} from "../environments/environment";
import {AppRoutingModule} from "./app-routing.module";
import {AppComponent} from "./app.component";
import {DocCardComponent} from "./components/doc-card/doc-card.component";
import {FragmentLinkComponent} from "./components/fragment-link/fragment-link.component";
import {TocComponent} from "./components/toc/toc.component";
import {DocListComponent} from "./pages/doc-list/doc-list.component";
import {DocComponent} from "./pages/doc/doc.component";
import {DocsLayoutComponent} from "./pages/docs-layout/docs-layout.component";
import {DocsComponent} from "./pages/docs/docs.component";
import {HomeComponent} from "./pages/home/home.component";
import {InlineSVGModule} from "ng-inline-svg";
import {HomeSectionComponent} from "./components/home-section/home-section.component";
import {FeaturesComponent} from "./pages/features/features.component";
import {HeaderComponent} from "./components/header/header.component";
import {FooterComponent} from "./components/footer/footer.component";
import {DocCardsComponent} from "./components/doc-cards/doc-cards.component";
import {EnterpriseComponent} from "./pages/enterprise/enterprise.component";
import {PartnersComponent} from "./pages/partners/partners.component";
import {IntersectDirective} from "./directives/intersect.directive";
import {SupportPolicyComponent} from "./pages/support-policy/support-policy.component";
import {LimitPolicyComponent} from "./pages/limit-policy/limit-policy.component";
import {FairusagePolicyComponent} from "./pages/fairusage-policy/fairusage-policy.component";
import {CalendarComponent} from "./pages/calendar/calendar.component";
@NgModule({
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AppRoutingModule,
    ServiceWorkerModule.register("ngsw-worker.js", {
      enabled: environment.production
    }),
    InlineSVGModule.forRoot(),
    FlexLayoutModule,
    MatCardModule,
    MatToolbarModule,
    MatGridListModule,
    MatMenuModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatSidenavModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatExpansionModule
  ],
  declarations: [
    AppComponent,
    HomeComponent,
    DocsComponent,
    DocListComponent,
    DocComponent,
    FragmentLinkComponent,
    DocsLayoutComponent,
    TocComponent,
    DocCardComponent,
    DocCardsComponent,
    HomeSectionComponent,
    FeaturesComponent,
    HeaderComponent,
    FooterComponent,
    EnterpriseComponent,
    PartnersComponent,
    IntersectDirective,
    SupportPolicyComponent,
    LimitPolicyComponent,
    FairusagePolicyComponent,
    CalendarComponent
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(injector: Injector) {
    customElements.define("fragment-link", createCustomElement(FragmentLinkComponent, {injector}));
    customElements.define("doc-toc", createCustomElement(TocComponent, {injector}));
    customElements.define("doc-card", createCustomElement(DocCardComponent, {injector}));
    customElements.define("doc-cards", createCustomElement(DocCardsComponent, {injector}));
  }
}
