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
  @Input() data: DashboardComponent;
  chartData: any;
  observable: Observable<any>;
  params: HttpParams = new HttpParams();
  constructor(private dashboardService: DashboardService) {}

  ngOnInit() {
    this.getData();
  }
  getData() {
    this.observable = this.dashboardService.executeComponent(this.data.url, this.params).pipe(
      tap(d => {
        Object.values(d).map(f => {
          if (f[this.data.key]) {
            f[this.data.key].type = this.data.type;
            this.chartData = f[this.data.key];
          }
        });
      })
    );
  }

  callOnChange(key: string, value: string) {
    this.params = this.params.set(key, value);
    this.getData();
  }
}
