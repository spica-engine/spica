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
import {SubscriptionAddComponent} from "./pages/subscription-add/subscription-add.component";
import {SubscriptionIndexComponent} from "./pages/subscription-index/subscription-index.component";
import {SubscriptionRoutingModule} from "./subscription-routing.module";
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
    SubscriptionRoutingModule
  ],
  declarations: [SubscriptionAddComponent, SubscriptionIndexComponent]
})
export class SubscriptionModule {}
