import {HttpClient, HttpParams} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Store} from "@ngrx/store";
import {Observable, of} from "rxjs";
import {tap} from "rxjs/operators";
import {Dashboard} from "../interfaces";
import * as fromDashboard from "../state/dashboard.reducer";

@Injectable()
export class DashboardService {
  constructor(private http: HttpClient, private store: Store<fromDashboard.State>) {}

  getDashboards(): Observable<Dashboard[]> {
    return this.store.select(fromDashboard.selectAll);
  }

  getDashboard(id: string): Observable<Dashboard> {
    return this.store.select(fromDashboard.selectEntity(id));
  }

  executeComponent(url: string) {
    return of({
      title: "line title",
      options: {legend: {display: true}, responsive: true},
      label: ["1", "2", "3", "4", "5", "6"],
      datasets: [{data: [65, 59, 90, 81, 56, 55, 40], label: "linedata"}],
      legend: true,
      width: 70,
      filters: [{key: "line_data_filter", title: "Please enter filter", type: "string"}]
    });
  }

  retrieve() {
    return this.http
      .get<Dashboard[]>(`api:/dashboard`)
      .pipe(tap(dashboards => this.store.dispatch(new fromDashboard.Retrieve(dashboards))));
  }
}
