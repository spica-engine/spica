import {ScrollingModule} from "@angular/cdk/scrolling";
import {CommonModule} from "@angular/common";
import {ModuleWithProviders, NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatDatepickerModule} from "@angular/material/datepicker";
import {MatDividerModule} from "@angular/material/divider";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatListModule} from "@angular/material/list";
import {MatMenuModule} from "@angular/material/menu";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatSelectModule} from "@angular/material/select";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatSliderModule} from "@angular/material/slider";
import {MatSortModule} from "@angular/material/sort";
import {MatTableModule} from "@angular/material/table";
import {MatTabsModule} from "@angular/material/tabs";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {StoreModule} from "@ngrx/store";
import {InputModule} from "@spica-client/common";
import {EditorModule} from "@spica-client/common/code-editor";
import {LAYOUT_INITIALIZER, RouteService} from "@spica-client/core";
import {ACTIVITY_FACTORY} from "@spica-client/core/factories/factory";
import {provideActivityFactory} from "@spica-client/function/providers/activity";
import {provideWsInterceptor} from "@spica-client/function/providers/websocket";
import {MatAwareDialogModule, MatClipboardModule, MatSaveModule} from "@spica-client/material";
import {PassportService} from "@spica-client/passport";
import {PassportModule} from "../passport/passport.module";
import {LanguageDirective} from "./directives/dynamic.language";
import {FunctionRoutingModule} from "./function-routing.module";
import {FunctionInitializer} from "./function.initializer";
import {FunctionService} from "./services/function.service";
import {FunctionOptions, FUNCTION_OPTIONS, WEBSOCKET_INTERCEPTOR} from "./interface";
import {AddComponent} from "./pages/add/add.component";
import {ExampleComponent} from "@spica-client/common/example";
import {IndexComponent} from "./pages/index/index.component";
import {LogViewComponent} from "./pages/log-view/log-view.component";
import {WelcomeComponent} from "./pages/welcome/welcome.component";
import {EnqueuerPipe} from "./pipes/enqueuer";
import * as fromFunction from "./reducers/function.reducer";
import {WebhookModule} from "./webhook.module";
import {RepositoryComponent} from "./components/repository/repository.component";

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    FunctionRoutingModule,
    MatCardModule,
    MatIconModule,
    MatAwareDialogModule,
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
    PassportModule.forChild(),
    WebhookModule,
    MatSaveModule,
    MatDatepickerModule,
    ScrollingModule,
    MatClipboardModule,
    EditorModule
  ],
  declarations: [
    RepositoryComponent,
    AddComponent,
    IndexComponent,
    LogViewComponent,
    WelcomeComponent,
    LanguageDirective,
    EnqueuerPipe,
    ExampleComponent
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
          useFactory: provideWsInterceptor,
          deps: [FUNCTION_OPTIONS]
        },
        {
          provide: FunctionInitializer,
          useClass: FunctionInitializer,
          deps: [FunctionService, RouteService, PassportService]
        },
        {
          provide: LAYOUT_INITIALIZER,
          useFactory: provideFunctionLoader,
          multi: true,
          deps: [FunctionInitializer]
        },
        {
          provide: ACTIVITY_FACTORY,
          useValue: provideActivityFactory,
          multi: true
        }
      ]
    };
  }
}
export function provideFunctionLoader(l: FunctionInitializer) {
  return l.appInitializer.bind(l);
}
