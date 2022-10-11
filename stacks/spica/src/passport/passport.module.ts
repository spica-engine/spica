import {DragDropModule} from "@angular/cdk/drag-drop";
import {CommonModule} from "@angular/common";
import {HTTP_INTERCEPTORS} from "@angular/common/http";
import {ModuleWithProviders, NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatGridListModule} from "@angular/material/grid-list";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatDialogModule} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatListModule} from "@angular/material/list";
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
import {CommonModule as SpicaCommon, InputModule} from "@spica-client/common";
import {LAYOUT_ACTIONS, ROUTE_FILTERS} from "@spica-client/core";
import {ACTIVITY_FACTORY} from "@spica-client/core/factories/factory";
import {MatAwareDialogModule, MatClipboardModule} from "@spica-client/material";
import {provideActivityFactory} from "@spica-client/passport/providers/activity";
import {AccessTokenComponent} from "./components/access-token/access-token.component";
import {IdentityBadgeComponent} from "./components/identity-badge/identity-badge.component";
import {HomeBadgeComponent} from "./components/home-badge/home-badge.component";
import {StrategyDialogComponent} from "./components/strategy-dialog/strategy-dialog.component";
import {CanInteractDirective} from "./directives/can-interact.directive";
import {ApiKeyAddComponent} from "./pages/apikey-add/apikey-add.component";
import {ApiKeyIndexComponent} from "./pages/apikey-index/apikey-index.component";
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
import {AuthorizationInterceptor} from "./services/authorization.interceptor";
import {PassportRouteFilter} from "./services/route.filter";
import {MatResizeHeaderModule} from "@spica-client/material/resize";
import {MatSortModule} from "@angular/material/sort";
import {FilterComponent} from "./components/filter/filter.component";
import {PolicyResourceAddComponent} from "./components/policy-resource-add/policy-resource-add.component";
import {MatFormFieldModule} from "@angular/material/form-field";

@NgModule({
  declarations: [
    IdentifyComponent,
    IdentityAddComponent,
    IdentityIndexComponent,
    PolicyAddComponent,
    PolicyIndexComponent,
    IdentitySettingsComponent,
    FilterComponent,
    IdentityBadgeComponent,
    HomeBadgeComponent,
    TabsComponent,
    StrategiesComponent,
    StrategiesAddComponent,
    CanInteractDirective,
    ApiKeyIndexComponent,
    ApiKeyAddComponent,
    StrategyDialogComponent,
    PolicyResourceAddComponent,
    AccessTokenComponent
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
    SpicaCommon,
    MatResizeHeaderModule,
    MatSortModule,
    MatFormFieldModule,
    MatClipboardModule
  ],
  exports: [CanInteractDirective],
  entryComponents: [IdentityBadgeComponent, StrategyDialogComponent, HomeBadgeComponent]
})
export class PassportModule {
  static forRoot(): ModuleWithProviders<PassportModule> {
    return {
      ngModule: PassportModule,
      providers: [
        {provide: HTTP_INTERCEPTORS, useClass: AuthorizationInterceptor, multi: true},
        {
          provide: LAYOUT_ACTIONS,
          useValue: {component: HomeBadgeComponent, position: "right"},
          multi: true
        },
        {
          provide: LAYOUT_ACTIONS,
          useValue: {component: IdentityBadgeComponent, position: "right"},
          multi: true
        },
        {
          provide: LAYOUT_ACTIONS,
          useValue: {component: AccessTokenComponent, position: "left"},
          multi: true
        },
        {provide: ROUTE_FILTERS, useExisting: PassportRouteFilter, multi: true},

        {provide: ACTIVITY_FACTORY, useValue: provideActivityFactory, multi: true}
      ]
    };
  }

  static forChild(): ModuleWithProviders<PassportModule> {
    return {ngModule: PassportModule, providers: []};
  }
}
