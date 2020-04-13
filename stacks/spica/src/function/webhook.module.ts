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
import {WebhookLogViewComponent} from "./pages/webhook-log-view/webhook-log-view.component";
import {SatDatepickerModule, SatNativeDateModule} from "saturn-datepicker";
import {ScrollingModule} from '@angular/cdk/scrolling';
import { MatProgressSpinnerModule } from "@angular/material";
import {MatExpansionModule} from '@angular/material/expansion';


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
  declarations: [WebhookAddComponent, WebhookIndexComponent, WebhookLogViewComponent]
})
export class WebhookModule {}
