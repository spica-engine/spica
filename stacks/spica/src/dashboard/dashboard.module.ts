import {CommonModule} from "@angular/common";
import {NgModule} from "@angular/core";
import {MatCardModule} from "@angular/material/card";
import {MatIconModule} from "@angular/material/icon";
import {MatListModule} from "@angular/material/list";
import {DashboardRoutingModule} from "./dashboard-routing.module";
import {DashboardComponent} from "./pages/dashboard/dashboard.component";

@NgModule({
  imports: [CommonModule, MatCardModule, MatIconModule, MatListModule, DashboardRoutingModule],
  declarations: [DashboardComponent]
})
export class DashboardModule {}
