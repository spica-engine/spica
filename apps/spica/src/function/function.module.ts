import {ScrollingModule} from "@angular/cdk/scrolling";
import {CommonModule} from "@angular/common";
import {ModuleWithProviders, NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatCardModule} from "@angular/material/card";
import {MatDatepickerModule} from "@angular/material/datepicker";
import {MatDividerModule} from "@angular/material/divider";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatListModule} from "@angular/material/list";
import {MatInputModule} from "@angular/material/input";
import {MatMenuModule} from "@angular/material/menu";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatLegacyProgressSpinnerModule as MatProgressSpinnerModule} from "@angular/material/legacy-progress-spinner";
import {MatSelectModule} from "@angular/material/select";
import {MatLegacySlideToggleModule as MatSlideToggleModule} from "@angular/material/legacy-slide-toggle";
import {MatSliderModule} from "@angular/material/slider";
import {MatSortModule} from "@angular/material/sort";
import {MatLegacyTableModule as MatTableModule} from "@angular/material/legacy-table";
import {MatLegacyTabsModule as MatTabsModule} from "@angular/material/legacy-tabs";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatLegacyTooltipModule as MatTooltipModule} from "@angular/material/legacy-tooltip";
import {StoreModule} from "@ngrx/store";
import {InputModule} from "@spica-client/common";
import {EditorModule} from "@spica-client/common/code-editor";
import {LAYOUT_INITIALIZER, RouteService} from "@spica-client/core";
import {BUILDLINK_FACTORY} from "@spica-client/core/factories/factory";
import {provideActivityFactory, provideAssetFactory} from "@spica-client/function/providers";
import {MatAwareDialogModule, MatClipboardModule, MatSaveModule} from "@spica-client/material";
import {PassportService} from "@spica-client/passport";
import {PassportModule} from "../passport/passport.module";
import {LanguageDirective} from "./directives/dynamic.language";
import {FunctionRoutingModule} from "./function-routing.module";
import {FunctionInitializer} from "./function.initializer";
import {WebhookInitializer} from "./webhook.initializer";
import {FunctionService} from "./services/function.service";
import {FunctionOptions, FUNCTION_OPTIONS, WEBSOCKET_INTERCEPTOR} from "./interface";
import {AddComponent} from "./pages/add/add.component";
import {ExampleComponent} from "@spica-client/common/example";
import {ConfigurationComponent} from "./components/configuration/configuration.component";
import {FunctionActionsComponent} from "./pages/function-actions/function-actions.component";
import {LogViewComponent} from "./pages/log-view/log-view.component";
import {WelcomeComponent} from "./pages/welcome/welcome.component";
import {EnqueuerPipe} from "./pipes/enqueuer";
import * as fromFunction from "./reducers/function.reducer";
import * as fromWebhook from "./reducers/webhook.reducer";
import {WebhookModule} from "./webhook.module";
import {MatDialogModule} from "@angular/material/dialog";
import {WebhookService} from "./services";
import {ASSET_CONFIG_EXPORTER, ASSET_RESOURCE_LISTER} from "@spica-client/asset/interfaces";
import {assetConfigExporter, listResources} from "./asset";

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    FunctionRoutingModule,
    MatCardModule,
    MatIconModule,
    MatAwareDialogModule,
    MatDialogModule,
    MatTableModule,
    MatButtonModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatSelectModule,
    MatListModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatToolbarModule,
    MatTabsModule,
    MatMenuModule,
    MatSliderModule,
    MatDatepickerModule,
    InputModule,
    MatTabsModule,
    StoreModule.forFeature("function", fromFunction.reducer),
    StoreModule.forFeature("webhook", fromWebhook.reducer),
    PassportModule.forChild(),
    WebhookModule,
    MatSaveModule,
    MatDatepickerModule,
    ScrollingModule,
    MatClipboardModule,
    EditorModule
  ],
  declarations: [
    AddComponent,
    FunctionActionsComponent,
    LogViewComponent,
    WelcomeComponent,
    LanguageDirective,
    EnqueuerPipe,
    ExampleComponent,
    ConfigurationComponent
  ]
})
export class FunctionModule {
  public static forRoot(options: FunctionOptions): ModuleWithProviders<FunctionModule> {
    return {
      ngModule: FunctionModule,
      providers: [
        {provide: FUNCTION_OPTIONS, useValue: options},
        {
          provide: WEBSOCKET_INTERCEPTOR,
          useFactory: () => options.url.replace("http", "ws")
        },
        {
          provide: FunctionInitializer,
          useClass: FunctionInitializer,
          deps: [FunctionService, RouteService, PassportService]
        },
        {
          provide: WebhookInitializer,
          useClass: WebhookInitializer,
          deps: [WebhookService, RouteService, PassportService]
        },
        {
          provide: LAYOUT_INITIALIZER,
          useFactory: provideFunctionLoader,
          multi: true,
          deps: [FunctionInitializer]
        },
        {
          provide: BUILDLINK_FACTORY,
          useValue: {caller: "activity", factory: provideActivityFactory},
          multi: true
        },
        {
          provide: BUILDLINK_FACTORY,
          useValue: {caller: "asset", factory: provideAssetFactory},
          multi: true
        },
        {
          provide: ASSET_CONFIG_EXPORTER,
          useFactory: assetConfigExporter,
          deps: [FunctionService],
          multi: true
        },
        {
          provide: ASSET_RESOURCE_LISTER,
          useFactory: fs => {
            return {name: "function", list: () => listResources(fs)};
          },
          deps: [FunctionService],
          multi: true
        },
        {
          provide: LAYOUT_INITIALIZER,
          useFactory: provideWebhookLoader,
          multi: true,
          deps: [WebhookInitializer]
        }
      ]
    };
  }
}
export function provideFunctionLoader(l: FunctionInitializer) {
  return l.appInitializer.bind(l);
}
export function provideWebhookLoader(w: WebhookInitializer) {
  return w.appInitializer.bind(w);
}
