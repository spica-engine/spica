import {CommonModule} from "@angular/common";
import {NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {
  MatFormFieldModule,
  MatInputModule,
  MatPaginatorModule,
  MatSortModule,
  MatTableModule,
  MatButtonModule,
  MatTooltipModule,
  MatToolbarModule
} from "@angular/material";
import {MatCardModule} from "@angular/material/card";
import {MatIconModule} from "@angular/material/icon";
import {MatListModule} from "@angular/material/list";
import {BrowserModule} from "@angular/platform-browser";
import {StoreModule} from "@ngrx/store";
import {InputModule} from "@spica-client/common";
import {LAYOUT_INITIALIZER, RouteService} from "@spica-client/core";
import {ChartsModule} from "ng2-charts";
import {PassportService} from "../passport";
import {DashboardRoutingModule} from "./dashboard-routing.module";
import {DashboardChartComponent} from "./pages/dashboard-chart/dashboard-chart.component";
import {DashboardTableComponent} from "./pages/dashboard-table/dashboard-table.component";
import {DashboardViewComponent} from "./pages/dashboard-view/dashboard-view.component";
import {DashboardComponent} from "./pages/dashboard/dashboard.component";
import {DashboardInitializer} from "./services/dashboard.initializer";
import {DashboardService} from "./services/dashboard.service";
import * as fromDashboard from "./state/dashboard.reducer";

@NgModule({
  imports: [
    CommonModule,
    MatCardModule,
    MatListModule,
    DashboardRoutingModule,
    MatToolbarModule,
    MatIconModule,
    ChartsModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    BrowserModule,
    MatButtonModule,
    MatTooltipModule,
    MatSortModule,
    MatTableModule,
    StoreModule.forFeature("dashboard", fromDashboard.reducer),
    InputModule,
    FormsModule
  ],
  declarations: [
    DashboardComponent,
    DashboardViewComponent,
    DashboardTableComponent,
    DashboardChartComponent
  ],
  providers: [
    DashboardService,
    {
      provide: DashboardInitializer,
      useClass: DashboardInitializer,
      deps: [DashboardService, RouteService, PassportService]
    },
    {
      provide: LAYOUT_INITIALIZER,
      useFactory: provideDashboardLoader,
      multi: true,
      deps: [DashboardInitializer]
    }
  ]
})
export class DashboardModule {}

export function provideDashboardLoader(l: DashboardInitializer) {
  return l.appInitializer.bind(l);
}
