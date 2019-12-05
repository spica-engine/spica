import {Component} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {Observable} from "rxjs";
import {switchMap} from "rxjs/operators";
import {DashboardService} from "../../services/dashboard.service";

@Component({
  selector: "app-dashboard-view",
  templateUrl: "./dashboard-view.component.html",
  styleUrls: ["./dashboard-view.component.scss"]
})
export class DashboardViewComponent {
  widgets$: Observable<any>;

  constructor(private activatedRoute: ActivatedRoute, private ds: DashboardService) {}

  ngOnInit() {
    this.widgets$ = this.activatedRoute.params.pipe(
      switchMap(params => this.ds.getDashboard(params.id))
    );
  }
}
