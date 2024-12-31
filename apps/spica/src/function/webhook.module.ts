import {ScrollingModule} from "@angular/cdk/scrolling";
import {CommonModule} from "@angular/common";
import {NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatLegacyCardModule as MatCardModule} from "@angular/material/legacy-card";
import {MatDatepickerModule} from "@angular/material/datepicker";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatIconModule} from "@angular/material/icon";
import {MatLegacyInputModule as MatInputModule} from "@angular/material/legacy-input";
import {MatLegacyListModule as MatListModule} from "@angular/material/legacy-list";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatLegacyProgressSpinnerModule as MatProgressSpinnerModule} from "@angular/material/legacy-progress-spinner";
import {MatLegacySelectModule as MatSelectModule} from "@angular/material/legacy-select";
import {MatLegacySlideToggleModule as MatSlideToggleModule} from "@angular/material/legacy-slide-toggle";
import {MatLegacyTableModule as MatTableModule} from "@angular/material/legacy-table";
import {MatToolbarModule} from "@angular/material/toolbar";
import {InputModule} from "@spica-client/common";
import {EditorModule} from "@spica-client/common/code-editor";
import {MatAwareDialogModule, MatSaveModule} from "@spica-client/material";
import {PassportModule} from "@spica-client/passport";
import {WebhookAddComponent} from "./pages/webhook-add/webhook-add.component";
import {WebhookIndexComponent} from "./pages/webhook-index/webhook-index.component";
import {WebhookLogViewComponent} from "./pages/webhook-log-view/webhook-log-view.component";
import {WebhookWelcomeComponent} from "./pages/webhook-welcome/webhook-welcome.component";
import {WebhookRoutingModule} from "./webhook-routing.module";
import {MatResizeHeaderModule} from "@spica-client/material/resize";
import {MatLegacyMenuModule as MatMenuModule} from "@angular/material/legacy-menu";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {CommonModule as SpicaCommon} from "@spica-client/common";
import {MatSortModule} from "@angular/material/sort";

@NgModule({
  imports: [
    CommonModule,
    SpicaCommon,
    FormsModule,
    InputModule,
    PassportModule.forChild(),
    WebhookRoutingModule,
    EditorModule,
    MatAwareDialogModule,
    MatIconModule,
    MatToolbarModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatCardModule,
    MatListModule,
    MatSelectModule,
    MatDatepickerModule,
    MatInputModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    ScrollingModule,
    MatExpansionModule,
    MatSaveModule,
    MatResizeHeaderModule,
    MatMenuModule,
    MatCheckboxModule,
    MatSortModule
  ],
  declarations: [
    WebhookAddComponent,
    WebhookIndexComponent,
    WebhookLogViewComponent,
    WebhookWelcomeComponent
  ]
})
export class WebhookModule {}
