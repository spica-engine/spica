import {NgModule} from "@angular/core";
import {CommonModule} from "@angular/common";
import {IndexComponent} from "@spica-client/activity/pages/index/index.component";
import {ActivityRoutingModule} from "@spica-client/activity/activity-routing.module";
import {
  MatIconModule,
  MatToolbarModule,
  MatCardModule,
  MatTableModule,
  MatOptionModule,
  MatSelectModule,
  MatInputModule,
  MatButtonModule
} from "@angular/material";
import {SatDatepickerModule, SatNativeDateModule} from "saturn-datepicker";
import {FormsModule} from "@angular/forms";
import {ActivityService} from "./services/activity.service";

@NgModule({
  declarations: [IndexComponent],
  imports: [
    CommonModule,
    ActivityRoutingModule,
    MatIconModule,
    MatToolbarModule,
    MatCardModule,
    MatTableModule,
    MatOptionModule,
    MatSelectModule,
    MatInputModule,
    SatDatepickerModule,
    SatNativeDateModule,
    FormsModule,
    MatButtonModule
  ],
  providers: [ActivityService]
})
export class ActivityModule {}
