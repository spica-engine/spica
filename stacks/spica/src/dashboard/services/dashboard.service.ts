import {HttpClient, HttpParams} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Store} from "@ngrx/store";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";
import {Dashboard} from "../interfaces";
import * as fromDashboard from "../state/dashboard.reducer";

@Injectable()
export class DashboardService {
  constructor(private http: HttpClient, private store: Store<fromDashboard.State>) {}

  findAll(): Observable<Dashboard[]> {
    return this.store.select(fromDashboard.selectAll);
  }

  findOne(id: string): Observable<Dashboard> {
    return this.store.select(fromDashboard.selectEntity(id));
  }

  executeComponent(url: string, filter: {[key: string]: string}): Observable<any> {
    const params = new HttpParams({fromObject: {filter: JSON.stringify(filter)}});
    return this.http.get(url, {params: params});
  }

  update(dashboard: Dashboard) {
    return this.http.put(`api:/dashboard/${dashboard._id}`, dashboard);
    //.pipe(tap(updatedDashboard => this.store.));
  }

  insert(dashboard: Dashboard) {
    return this.http.post("api:/dashboard", dashboard);
  }

  delete(id: string) {
    return this.http.delete(`api:/dashboard/${id}`);
  }

  retrieve() {
    return this.http
      .get<Dashboard[]>("api:/dashboard")
      .pipe(tap(dashboards => this.store.dispatch(new fromDashboard.Retrieve(dashboards))));
  }
}
