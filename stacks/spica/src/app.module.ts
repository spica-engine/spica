import {HttpClientModule} from "@angular/common/http";
import {NgModule} from "@angular/core";
import {BrowserModule} from "@angular/platform-browser";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {RouterModule} from "@angular/router";
import {StoreModule} from "@ngrx/store";
import {StoreDevtoolsModule} from "@ngrx/store-devtools";
import {BaseUrlInterceptorModule, LayoutModule, RouteModule} from "@spica-client/core";
import {environment} from "../environments/environment";
import {AppComponent} from "./app.component";
import {BucketModule} from "./bucket";
import {ComposerModule} from "./composer/composer.module";
import {DashboardModule} from "./dashboard/dashboard.module";
import {FunctionModule} from "./function/function.module";
import {PassportModule} from "./passport";
import {StorageModule} from "./storage/storage.module";

@NgModule({
  imports: [
    /** Initialize main modules. */
    BrowserModule,
    BrowserAnimationsModule,
    RouterModule.forRoot([], {paramsInheritanceStrategy: "always"}),
    HttpClientModule,
    BaseUrlInterceptorModule.forRoot({api: environment.api}),
    RouteModule.forRoot(),
    LayoutModule.forRoot(),
    StoreModule.forRoot([]),
    StoreDevtoolsModule.instrument({
      logOnly: environment.production
    }),
    /**
     * Core Feature Modules
     */
    DashboardModule,
    PassportModule.forRoot(),
    BucketModule.forRoot(),
    StorageModule.forRoot(),
    FunctionModule.forRoot({url: environment.api}),
    ComposerModule.forRoot({url: environment.api})
  ],
  declarations: [AppComponent],
  bootstrap: [AppComponent]
})
export class AppModule {}
