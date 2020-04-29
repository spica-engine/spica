import {CommonModule} from "@angular/common";
import {ModuleWithProviders, NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatCheckboxModule} from "@angular/material/checkbox";
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
import {MatSortModule} from "@angular/material/sort";
import {MatTableModule} from "@angular/material/table";
import {MatTabsModule} from "@angular/material/tabs";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {RouterModule} from "@angular/router";
import {StoreModule} from "@ngrx/store";
import {InputModule} from "@spica-client/common";
import {MatAwareDialogModule} from "@spica-client/material";
import {SatDatepickerModule, SatNativeDateModule} from "saturn-datepicker";
import {PassportModule} from "../passport/passport.module";
import {EditorComponent} from "./components/editor/editor.component";
import {LanguageDirective} from "./components/editor/language.directive";
import {FunctionRoutingModule} from "./function-routing.module";
import {FunctionOptions, FUNCTION_OPTIONS} from "./interface";
import {AddComponent} from "./pages/add/add.component";
import {IndexComponent} from "./pages/index/index.component";
import {LogViewComponent} from "./pages/log-view/log-view.component";
import {WelcomeComponent} from "./pages/welcome/welcome.component";
import {EnqueuerPipe} from "./pipes/enqueuer";
import * as fromFunction from "./reducers/function.reducer";
import {WebhookModule} from "./webhook.module";
import {FunctionService} from "./function.service";
import {FunctionInitializer} from "./function.initializer";
import {RouteService, LAYOUT_INITIALIZER} from "@spica-client/core";
import {PassportService} from "@spica-client/passport";
import {MatSaveModule} from "@spica-client/material";
import {ACTIVITY_FACTORY} from "@spica-client/core/factories/factory";
import {provideActivityFactory} from "@spica-client/function/providers/activity";

@NgModule({
  declarations: [
    AddComponent,
    IndexComponent,
    LogViewComponent,
    WelcomeComponent,
    EditorComponent,
    LanguageDirective,
    EnqueuerPipe
  ],
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
    RouterModule,
    SatDatepickerModule,
    SatNativeDateModule,
    InputModule,
    MatTabsModule,
    StoreModule.forFeature("function", fromFunction.reducer),
    PassportModule.forChild(),
    WebhookModule,
    MatSaveModule
  ]
})
export class FunctionModule {
  public static forRoot(options: FunctionOptions): ModuleWithProviders {
    return {
      ngModule: FunctionModule,
      providers: [
        {provide: FUNCTION_OPTIONS, useValue: options},
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
