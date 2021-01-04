import {Component, OnInit} from "@angular/core";
import {DashboardService} from "@spica-client/dashboard/services/dashboard.service";
import {Dashboard} from "@spica-client/dashboard/interfaces";
import {Observable} from "rxjs";

@Component({
  selector: "dashboard-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent implements OnInit {
  displayedColumns = ["id", "name", "actions"];

  dashboards$: Observable<Dashboard[]>;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit() {
    this.dashboards$ = this.dashboardService.findAll();
  }

  deleteDashboard(id: string) {
    this.dashboardService.delete(id).toPromise();
  }
}
