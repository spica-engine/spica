import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Store} from "@ngrx/store";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";
import {Dashboard} from "../interfaces";
import * as fromDashboard from "../state/dashboard.reducer";

@Injectable()
export class DashboardService {
  constructor(private http: HttpClient, private store: Store<fromDashboard.State>) {}

  getDashboards(): Observable<Dashboard[]> {
    return this.store.select(fromDashboard.selectAll);
  }

  getDashboard(key: string): Observable<Dashboard> {
    return this.store.select(fromDashboard.selectEntity(key));
  }

  retrieve() {
    return this.http
      .get<Dashboard[]>(`api:/dashboard`)
      .pipe(tap(dashboards => this.store.dispatch(new fromDashboard.Retrieve(dashboards))));
  }
}
