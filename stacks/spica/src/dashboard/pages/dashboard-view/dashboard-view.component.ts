import {Component} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {Observable} from "rxjs";
import {switchMap, tap} from "rxjs/operators";
import {DashboardService} from "../../services/dashboard.service";
import {Dashboard} from "@spica-client/dashboard/interfaces";

@Component({
  selector: "app-dashboard-view",
  templateUrl: "./dashboard-view.component.html",
  styleUrls: ["./dashboard-view.component.scss"]
})
export class DashboardViewComponent {
  dashboard$: Observable<Dashboard>;

  constructor(private activatedRoute: ActivatedRoute, private ds: DashboardService) {}

  ngOnInit() {
    this.dashboard$ = this.activatedRoute.params.pipe(
      switchMap(params => this.ds.getDashboard(params.id))
    );
  }
}
