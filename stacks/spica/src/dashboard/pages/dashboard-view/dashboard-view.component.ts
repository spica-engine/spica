import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { RouteService } from "@spica-server/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { DashboardService } from "../../services/dashboard.service";

@Component({
  selector: "app-dashboard-view",
  templateUrl: "./dashboard-view.component.html",
  styleUrls: ["./dashboard-view.component.scss"]
})
export class DashboardViewComponent {
  widgets$: Observable<any>;
  dashboard: string;

  constructor(
    private activatedRoute: ActivatedRoute,
    private ds: DashboardService,
    private routeService: RouteService
  ) {}

  ngOnInit() {
    this.activatedRoute.params.subscribe(data => {
      this.routeService.routes
        .pipe(
          map(routes =>
            routes.filter(r => {
              if (r.id == `dashboard_${data.id}`) {
                this.dashboard = r.display;
              }
            })
          )
        )
        .subscribe();
      this.widgets$ = this.ds.getDashboard(data.id);
    });
  }
}
