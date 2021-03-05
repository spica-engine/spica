import {LayoutModule as CdkLayoutModule} from "@angular/cdk/layout";
import {CommonModule} from "@angular/common";
import {HTTP_INTERCEPTORS} from "@angular/common/http";
import {ModuleWithProviders, NgModule} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatIconModule} from "@angular/material/icon";
import {MatListModule} from "@angular/material/list";
import {MatSidenavModule} from "@angular/material/sidenav";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {RouterModule, Routes} from "@angular/router";
import {DEFAULT_LAYOUT, LayoutConfig, LAYOUT_ACTIONS} from "./config";
import {ErrorInterceptor} from "./error.interceptor";
import {ErrorPageComponent} from "./error/error.page";
import {HomeLayoutComponent} from "./home/home.layout";
import {LayoutRouterOutlet} from "./router_outlet";
import {SchemeSwitcherComponent} from "./scheme-switcher/scheme-switcher.component";
import {SchemeObserver} from "./scheme.observer";
import {SnackbarComponent} from "./snackbar/snackbar.component";
import {MatSnackBarModule} from "@angular/material/snack-bar";
import {ToolbarActionDirective} from "./toolbar-action";
import {MAT_FORM_FIELD_DEFAULT_OPTIONS} from "@angular/material/form-field";
import {MatMenuModule} from "@angular/material/menu";
import {Route} from "../route";
import {RouteCategory} from "../route/route";
import {RouteModule} from "../route/route.module";
import {AssetStoreComponent} from "./asset-store/asset-store.component";

const routes: Routes = [
  {path: "error", component: ErrorPageComponent, data: {layout: false}},
  {path: "assets", component: AssetStoreComponent}
];

const route: Route[] = [
  {
    category: RouteCategory.Primary,
    icon: "shopping_cart",
    path: "assets",
    display: "Asset Store",
    id: "asset_store",
    index: 3
  }
];

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
    RouteModule.forChild(route),
    MatSnackBarModule,
    MatMenuModule
  ],
  providers: [SchemeObserver],
  declarations: [
    HomeLayoutComponent,
    LayoutRouterOutlet,
    ErrorPageComponent,
    SchemeSwitcherComponent,
    SnackbarComponent,
    ToolbarActionDirective,
    AssetStoreComponent
  ],
  exports: [LayoutRouterOutlet, RouterModule],
  entryComponents: [HomeLayoutComponent, SchemeSwitcherComponent, SnackbarComponent]
})
export class LayoutModule {
  static forRoot(config: LayoutConfig = {}): ModuleWithProviders<LayoutModule> {
    return {
      ngModule: LayoutModule,
      providers: [
        {provide: DEFAULT_LAYOUT, useValue: config.defaultLayout || HomeLayoutComponent},
        {provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true},
        {provide: LAYOUT_ACTIONS, useValue: SchemeSwitcherComponent, multi: true},
        {provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: {appearance: "outline"}}
      ]
    };
  }
}
