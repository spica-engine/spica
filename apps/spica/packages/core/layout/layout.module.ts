import {LayoutModule as CdkLayoutModule} from "@angular/cdk/layout";
import {BrowserModule, Title} from "@angular/platform-browser";
import {CommonModule} from "@angular/common";
import {HTTP_INTERCEPTORS} from "@angular/common/http";
import {ModuleWithProviders, NgModule} from "@angular/core";
import {MatLegacyButtonModule as MatButtonModule} from "@angular/material/legacy-button";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatIconModule} from "@angular/material/icon";
import {MatLegacyListModule as MatListModule} from "@angular/material/legacy-list";
import {MatSidenavModule} from "@angular/material/sidenav";
import {MatLegacySlideToggleModule as MatSlideToggleModule} from "@angular/material/legacy-slide-toggle";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatLegacyTooltipModule as MatTooltipModule} from "@angular/material/legacy-tooltip";
import {RouterModule, Routes} from "@angular/router";
import {DEFAULT_LAYOUT, IGNORE_HTTP_ERRORS, LayoutConfig, LAYOUT_ACTIONS} from "./config";
import {ErrorInterceptor} from "./error.interceptor";
import {ErrorPageComponent} from "./error/error.page";
import {HomeLayoutComponent} from "./home/home.layout";
import {LayoutRouterOutlet} from "./router_outlet";
import {SchemeSwitcherComponent} from "./scheme-switcher/scheme-switcher.component";
import {SchemeObserver} from "./scheme.observer";
import {SnackbarComponent} from "./snackbar/snackbar.component";
import {MatLegacySnackBarModule as MatSnackBarModule} from "@angular/material/legacy-snack-bar";
import {MatLegacyDialogModule as MatDialogModule} from "@angular/material/legacy-dialog";
import {MatLegacyChipsModule as MatChipsModule} from "@angular/material/legacy-chips";

import {ToolbarActionDirective} from "./toolbar-action";
import {MAT_LEGACY_FORM_FIELD_DEFAULT_OPTIONS as MAT_FORM_FIELD_DEFAULT_OPTIONS} from "@angular/material/legacy-form-field";
import {MatLegacyMenuModule as MatMenuModule} from "@angular/material/legacy-menu";
import {DragDropModule} from "@angular/cdk/drag-drop";
import {RouteItemComponent} from "./route/route-item/route-item.component";
import {BasicDrawerComponent} from "./route/drawers/basic/basic.component";
import {AdvancedDrawerComponent} from "./route/drawers/advanced/advanced.component";
import {MatLegacyInputModule as MatInputModule} from "@angular/material/legacy-input";
import {MatLegacyFormFieldModule as MatFormFieldModule} from "@angular/material/legacy-form-field";
import {FormsModule} from "@angular/forms";
import {MatAwareDialogModule} from "@spica-client/material";
import {RouteModule} from "../route";

const routes: Routes = [{path: "error", component: ErrorPageComponent, data: {layout: false}}];

@NgModule({
  imports: [
    CommonModule,
    RouterModule,
    MatExpansionModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatSlideToggleModule,
    CdkLayoutModule,
    RouterModule.forChild(routes),
    MatSnackBarModule,
    MatMenuModule,
    BrowserModule,
    DragDropModule,
    MatDialogModule,
    MatChipsModule,
    MatInputModule,
    MatFormFieldModule,
    FormsModule,
    MatAwareDialogModule,
    RouteModule
  ],
  providers: [SchemeObserver, Title],
  declarations: [
    HomeLayoutComponent,
    LayoutRouterOutlet,
    ErrorPageComponent,
    SchemeSwitcherComponent,
    SnackbarComponent,
    ToolbarActionDirective,
    RouteItemComponent,
    BasicDrawerComponent,
    AdvancedDrawerComponent
  ],
  exports: [
    LayoutRouterOutlet,
    RouterModule,
    RouteItemComponent,
    BasicDrawerComponent,
    AdvancedDrawerComponent
  ]
})
export class LayoutModule {
  static forRoot(config: LayoutConfig = {}): ModuleWithProviders<LayoutModule> {
    return {
      ngModule: LayoutModule,
      providers: [
        {
          provide: IGNORE_HTTP_ERRORS,
          useValue: (_, code) => code == 422,
          multi: true
        },
        {provide: DEFAULT_LAYOUT, useValue: config.defaultLayout || HomeLayoutComponent},
        {provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true},
        {provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: {appearance: "outline"}}
      ]
    };
  }
}
