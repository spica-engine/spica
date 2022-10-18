import {HttpClientModule} from "@angular/common/http";
import {NgModule} from "@angular/core";
import {BrowserModule, HammerModule} from "@angular/platform-browser";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {RouterModule} from "@angular/router";
import {StoreModule} from "@ngrx/store";
import {BaseUrlInterceptorModule, LayoutModule, RouteModule} from "@spica-client/core";
import {environment} from "../environments/environment";
import {ActivityModule} from "./activity/activity.module";
import {AppComponent} from "./app.component";
import {BucketModule} from "./bucket";
import {DashboardModule} from "./dashboard/dashboard.module";
import {FunctionModule} from "./function/function.module";
import {PassportModule} from "./passport";
import {StorageModule} from "./storage/storage.module";
import {ErrorStateMatcher, ShowOnDirtyErrorStateMatcher} from "@angular/material/core";
import {OverlayContainer, FullscreenOverlayContainer} from "@angular/cdk/overlay";
import {AssetModule} from "./asset/asset.module";

const API_FULL_URL = environment.api.startsWith("http")
  ? environment.api
  : window.location.origin + environment.api;

@NgModule({
  imports: [
    /** Initialize main modules. */
    BrowserModule,
    HammerModule,
    BrowserAnimationsModule,
    RouterModule.forRoot([], {
      paramsInheritanceStrategy: "always",
      relativeLinkResolution: "legacy"
    }),
    HttpClientModule,
    BaseUrlInterceptorModule.forRoot({api: environment.api}),
    RouteModule.forRoot(),
    LayoutModule.forRoot(),
    StoreModule.forRoot([]),
    /**
     * Core Feature Modules
     */
    DashboardModule,
    ActivityModule,
    PassportModule.forRoot(),
    BucketModule.forRoot({url: API_FULL_URL}),
    AssetModule,
    StorageModule.forRoot(),
    FunctionModule.forRoot({url: API_FULL_URL})
  ],
  providers: [
    {provide: ErrorStateMatcher, useClass: ShowOnDirtyErrorStateMatcher},
    {provide: OverlayContainer, useClass: FullscreenOverlayContainer}
  ],
  declarations: [AppComponent],
  bootstrap: [AppComponent]
})
export class AppModule {}
