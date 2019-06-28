import {CommonModule} from "@angular/common";
import {NgModule} from "@angular/core";
import {MatCardModule} from "@angular/material/card";
import {MatListModule} from "@angular/material/list";
import {LayoutModule} from "@spica-client/core";
import {DashboardRoutingModule} from "./dashboard-routing.module";
import {DashboardComponent} from "./pages/dashboard/dashboard.component";

@NgModule({
  imports: [CommonModule, LayoutModule, MatCardModule, MatListModule, DashboardRoutingModule],
  declarations: [DashboardComponent]
})
export class DashboardModule {}
