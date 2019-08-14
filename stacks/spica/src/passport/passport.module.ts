import {CommonModule} from "@angular/common";
import {HTTP_INTERCEPTORS} from "@angular/common/http";
import {ModuleWithProviders, NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatDialogModule} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatMenuModule} from "@angular/material/menu";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatSelectModule} from "@angular/material/select";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatStepperModule} from "@angular/material/stepper";
import {MatTableModule} from "@angular/material/table";
import {MatTabsModule} from "@angular/material/tabs";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {InputModule} from "@spica-client/common";
import {LAYOUT_ACTIONS, ROUTE_FILTERS} from "@spica-client/core";
import {MatAwareDialogModule} from "@spica-client/material";
import {CanInteractDirective} from "./directives/can-interact.directive";
import {IdentityBadgeComponent} from "./directives/identity-badge/identity-badge.component";
import {IdentifyComponent} from "./pages/identify/identify.component";
import {IdentityAddComponent} from "./pages/identity-add/identity-add.component";
import {IdentityIndexComponent} from "./pages/identity-index/identity-index.component";
import {IdentitySettingsComponent} from "./pages/identity-settings/identity-settings.component";
import {PolicyAddComponent} from "./pages/policy-add/policy-add.component";
import {PolicyIndexComponent} from "./pages/policy-index/policy-index.component";
import {StrategiesAddComponent} from "./pages/strategies-add/strategies-add.component";
import {StrategiesComponent} from "./pages/strategies/strategies.component";
import {TabsComponent} from "./pages/tabs/tabs.component";
import {PassportRoutingModule} from "./passport-routing.module";
import {PassportRouteFilter} from "./services/route.filter";
import {AuthorizationInterceptor} from "./services/authorization.interceptor";
import {MatGridListModule} from "@angular/material";
import {MatListModule} from "@angular/material/list";
import {DragDropModule} from "@angular/cdk/drag-drop";
import {CommonModule as SpicaCommon} from "@spica-client/common";

@NgModule({
  declarations: [
    IdentifyComponent,
    IdentityAddComponent,
    IdentityIndexComponent,
    PolicyAddComponent,
    PolicyIndexComponent,
    IdentitySettingsComponent,
    IdentityBadgeComponent,
    TabsComponent,
    StrategiesComponent,
    StrategiesAddComponent,
    CanInteractDirective
  ],
  imports: [
    CommonModule,
    FormsModule,
    PassportRoutingModule,
    MatTabsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDividerModule,
    MatInputModule,
    MatIconModule,
    MatCardModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatSlideToggleModule,
    MatStepperModule,
    MatTableModule,
    MatExpansionModule,
    MatDialogModule,
    MatSelectModule,
    MatTooltipModule,
    MatAwareDialogModule,
    MatToolbarModule,
    MatGridListModule,
    MatListModule,
    InputModule,
    DragDropModule,
    SpicaCommon
  ],
  exports: [CanInteractDirective],
  entryComponents: [IdentityBadgeComponent]
})
export class PassportModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: PassportModule,
      providers: [
        {provide: HTTP_INTERCEPTORS, useClass: AuthorizationInterceptor, multi: true},
        {provide: LAYOUT_ACTIONS, useValue: IdentityBadgeComponent, multi: true},
        {provide: ROUTE_FILTERS, useExisting: PassportRouteFilter, multi: true}
      ]
    };
  }

  static forChild(): ModuleWithProviders {
    return {ngModule: PassportModule, providers: []};
  }
}
