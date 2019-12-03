import {CommonModule} from "@angular/common";
import {NgModule} from "@angular/core";
import {MatCardModule} from "@angular/material/card";
import {MatIconModule} from "@angular/material/icon";
import {MatListModule} from "@angular/material/list";
import {DashboardRoutingModule} from "./dashboard-routing.module";
import {DashboardComponent} from "./pages/dashboard/dashboard.component";
import {DashboardInitializer} from "./services/dashboard.initializer";
import {DashboardService} from "./services/dashboard.service";
import {LAYOUT_INITIALIZER, RouteService} from "@spica-client/core";
import {PassportService} from "../passport";
import {DashboardViewComponent} from "./pages/dashboard-view/dashboard-view.component";
import {ChartsModule} from "ng2-charts";
import {
  MatTableModule,
  MatPaginatorModule,
  MatSortModule,
  MatFormFieldModule,
  MatInputModule
} from "@angular/material";
import {DashboardTableComponent} from "./pages/dashboard-table/dashboard-table.component";
import {BrowserModule} from "@angular/platform-browser";
import {DashboardChartComponent} from "./pages/dashboard-chart/dashboard-chart.component";
import {InputModule} from "@spica-client/common";
import {FormsModule} from "@angular/forms";
@NgModule({
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatListModule,
    DashboardRoutingModule,
    ChartsModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    BrowserModule,
    MatSortModule,
    MatTableModule,
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
