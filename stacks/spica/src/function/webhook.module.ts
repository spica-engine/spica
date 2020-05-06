import {ScrollingModule} from "@angular/cdk/scrolling";
import {CommonModule} from "@angular/common";
import {NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatListModule} from "@angular/material/list";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatSelectModule} from "@angular/material/select";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatTableModule} from "@angular/material/table";
import {MatToolbarModule} from "@angular/material/toolbar";
import {InputModule} from "@spica-client/common";
import {MatAwareDialogModule} from "@spica-client/material";
import {PassportModule} from "@spica-client/passport";
import {SatDatepickerModule, SatNativeDateModule} from "saturn-datepicker";
import {EditorComponent} from "./components/editor/editor.component";
import {HandlebarsLanguageDirective} from "./components/editor/handlebars.language";
import {WebhookAddComponent} from "./pages/webhook-add/webhook-add.component";
import {WebhookIndexComponent} from "./pages/webhook-index/webhook-index.component";
import {WebhookLogViewComponent} from "./pages/webhook-log-view/webhook-log-view.component";
import {WebhookWelcomeComponent} from "./pages/webhook-welcome/webhook-welcome.component";
import {WebhookRoutingModule} from "./webhook-routing.module";

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    InputModule,
    MatAwareDialogModule,
    MatIconModule,
    MatToolbarModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatCardModule,
    MatListModule,
    MatSelectModule,
    MatInputModule,
    MatSlideToggleModule,
    PassportModule.forChild(),
    WebhookRoutingModule,
    SatDatepickerModule,
    SatNativeDateModule,
    MatProgressSpinnerModule,
    ScrollingModule,
    MatExpansionModule
  ],
  declarations: [
    WebhookAddComponent,
    WebhookIndexComponent,
    WebhookLogViewComponent,
    WebhookWelcomeComponent,
    EditorComponent,
    HandlebarsLanguageDirective
  ],
  exports: [EditorComponent]
})
export class WebhookModule {}
