import {CommonModule} from "@angular/common";
import {NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatListModule} from "@angular/material/list";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatSelectModule} from "@angular/material/select";
import {MatTableModule} from "@angular/material/table";
import {MatToolbarModule} from "@angular/material/toolbar";
import {InputModule} from "@spica-client/common";
import {MatAwareDialogModule} from "@spica-client/material";
import {WebhookAddComponent} from "./pages/webhook-add/webhook-add.component";
import {WebhookIndexComponent} from "./pages/webhook-index/webhook-index.component";
import {WebhookRoutingModule} from "./webhook-routing.module";
import {PassportModule} from "@spica-client/passport";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";

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
    WebhookRoutingModule
  ],
  declarations: [WebhookAddComponent, WebhookIndexComponent]
})
export class WebhookModule {}
