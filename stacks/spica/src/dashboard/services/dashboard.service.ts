import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";
import {Store} from "@ngrx/store";
import * as fromDashboard from "../state/dashboard.reducer";

@Injectable()
export class DashboardService {
  constructor(private http: HttpClient, private store: Store<fromDashboard.State>) {}

  getDashboards(): Observable<any> {
    return this.http.get<any[]>(`api:/dashboard`);
  }
  getDashboard(key: string): Observable<any> {
    return this.http.get<any>(`api:/dashboard/${key}`);
  }

  retrieve() {
    return this.http
      .get<any[]>(`api:/dashboard`)
      .pipe(tap(dashboards => this.store.dispatch(new fromDashboard.Retrieve(dashboards))));
  }
}
