import {NgModule} from "@angular/core";
import {CommonModule} from "@angular/common";
import {IndexComponent} from "./pages/index/index.component";
import {ActivityRoutingModule} from "@spica-client/activity";
import {
  MatIconModule,
  MatToolbarModule,
  MatCardModule,
  MatTableModule,
  MatOptionModule,
  MatSelectModule,
  MatInputModule
} from "@angular/material";
import {SatDatepickerModule, SatNativeDateModule} from "saturn-datepicker";

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
    SatNativeDateModule
  ]
})
export class ActivityModule {}
