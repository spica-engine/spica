import {LayoutModule as CdkLayoutModule} from "@angular/cdk/layout";
import {CommonModule} from "@angular/common";
import {HTTP_INTERCEPTORS} from "@angular/common/http";
import {ModuleWithProviders, NgModule} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatIconModule} from "@angular/material/icon";
import {MatListModule} from "@angular/material/list";
import {MatSidenavModule} from "@angular/material/sidenav";
import {MatToolbarModule} from "@angular/material/toolbar";
import {RouterModule, Routes} from "@angular/router";
import {DEFAULT_LAYOUT, LayoutConfig} from "./config";
import {ErrorInterceptor} from "./error.interceptor";
import {ErrorPageComponent} from "./error/error.page";
import {HomeLayoutComponent} from "./home/home.layout";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {LayoutRouterOutlet} from "./router_outlet";
import {ThemeSwitcherComponent} from "./theme-switcher/theme-switcher.component";

const routes: Routes = [{path: "error", component: ErrorPageComponent, data: {layout: false}}];

@NgModule({
  imports: [
    CommonModule,
    RouterModule,
    MatExpansionModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatSlideToggleModule,
    CdkLayoutModule,
    RouterModule.forChild(routes)
  ],
  declarations: [
    HomeLayoutComponent,
    LayoutRouterOutlet,
    ErrorPageComponent,
    ThemeSwitcherComponent
  ],
  exports: [LayoutRouterOutlet, RouterModule],
  entryComponents: [HomeLayoutComponent]
})
export class LayoutModule {
  static forRoot(config: LayoutConfig = {}): ModuleWithProviders {
    return {
      ngModule: LayoutModule,
      providers: [
        {provide: DEFAULT_LAYOUT, useValue: config.defaultLayout || HomeLayoutComponent},
        {provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true},
        {provide: DEFAULT_LAYOUT, useValue: ThemeSwitcherComponent, multi: true}
      ]
    };
  }
}
