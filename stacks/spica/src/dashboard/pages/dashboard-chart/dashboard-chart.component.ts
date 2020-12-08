import {HttpParams} from "@angular/common/http";
import {Component, Input, OnInit} from "@angular/core";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";
import {Component as DashboardComponent} from "../../interfaces";
import {DashboardService} from "@spica-client/dashboard/services/dashboard.service";

@Component({
  selector: "app-dashboard-chart",
  templateUrl: "./dashboard-chart.component.html",
  styleUrls: ["./dashboard-chart.component.scss"]
})
export class DashboardChartComponent implements OnInit {
  @Input() component: DashboardComponent;
  componentData$: Observable<object>;
  params: HttpParams = new HttpParams();
  constructor(private dashboardService: DashboardService) {}
  ngOnInit() {
    this.componentData$ = this.dashboardService.executeComponent(this.component.url);
  }
  
  callOnChange(key: string, value: string) {
    this.params = this.params.set(key, value);
    // execute again
  }
}
