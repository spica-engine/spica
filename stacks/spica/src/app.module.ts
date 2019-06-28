import {HttpClientModule} from "@angular/common/http";
import {NgModule} from "@angular/core";
import {BrowserModule} from "@angular/platform-browser";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {RouterModule} from "@angular/router";
import {StoreModule} from "@ngrx/store";
import {StoreDevtoolsModule} from "@ngrx/store-devtools";
import {BaseUrlInterceptorModule, RouteModule} from "@spica-client/core";
import {LayoutModule} from "@spica-client/core";

import {environment} from "../environments/environment";

import {AppComponent} from "./app.component";
import {BucketModule} from "./bucket/bucket.module";
import {ComposerModule} from "./composer/composer.module";
import {DashboardModule} from "./dashboard/dashboard.module";
import {FunctionModule} from "./function/function.module";
import {PassportModule} from "./passport/passport.module";
import {StorageModule} from "./storage/storage.module";

@NgModule({
  imports: [
    /** Initialize main modules. */
    BrowserModule,
    BrowserAnimationsModule,
    RouterModule.forRoot([], {paramsInheritanceStrategy: "always"}),
    HttpClientModule,
    BaseUrlInterceptorModule.forRoot(environment.base_urls),
    RouteModule.forRoot(),
    LayoutModule.forRoot(),
    StoreModule.forRoot([]),
    StoreDevtoolsModule.instrument(),
    /**
     * Core Feature Modules
     */
    DashboardModule,
    PassportModule.forRoot(),
    BucketModule.forRoot(),
    StorageModule.forRoot(),
    FunctionModule.forRoot({url: environment.base_urls.api}),
    ComposerModule.forRoot({url: environment.base_urls.api})
  ],
  declarations: [AppComponent],
  bootstrap: [AppComponent]
})
export class AppModule {}
