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
  MatButtonModule,
  MatTooltipModule
} from "@angular/material";
import {ScrollingModule} from "@angular/cdk/scrolling";
import {MatListModule} from "@angular/material/list";
import {SatDatepickerModule, SatNativeDateModule} from "saturn-datepicker";
import {FormsModule} from "@angular/forms";
import {ActivityService} from "./services/activity.service";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {PassportModule} from "@spica-client/passport";
import {CommonModule as SpicaCommon} from "@spica-client/common";

@NgModule({
  declarations: [IndexComponent],
  imports: [
    CommonModule,
    ActivityRoutingModule,
    PassportModule.forChild(),
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
    MatButtonModule,
    ScrollingModule,
    MatListModule,
    MatProgressSpinnerModule,
    SpicaCommon,
    MatTooltipModule
  ],
  providers: [ActivityService]
})
export class ActivityModule {}
