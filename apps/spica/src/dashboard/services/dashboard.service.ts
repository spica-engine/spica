import {HttpClient, HttpParams} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Store} from "@ngrx/store";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";
import {Dashboard} from "../interfaces";
import * as fromDashboard from "../state/dashboard.reducer";
import {example} from "./example-code";

@Injectable()
export class DashboardService {
  constructor(
    private http: HttpClient,
    private store: Store<fromDashboard.State>
  ) {}

  getExample(type: string) {
    if (!type) {
      return `Select type to display example code.`;
    } else if (example[type]) {
      return example[type];
    }

    return `Example code for this type does not exist.`;
  }

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
    const id = dashboard._id;
    delete dashboard._id;

    return this.http
      .put<Dashboard>(`api:/dashboard/${id}`, dashboard)
      .pipe(
        tap(updatedDashboard => this.store.dispatch(new fromDashboard.Update(updatedDashboard)))
      );
  }

  insert(dashboard: Dashboard) {
    return this.http
      .post<Dashboard>("api:/dashboard", dashboard)
      .pipe(
        tap(insertedDashboard => this.store.dispatch(new fromDashboard.Add(insertedDashboard)))
      );
  }

  delete(id: string) {
    return this.http
      .delete(`api:/dashboard/${id}`)
      .pipe(tap(() => this.store.dispatch(new fromDashboard.Remove(id))));
  }

  retrieve() {
    return this.http
      .get<Dashboard[]>("api:/dashboard")
      .pipe(tap(dashboards => this.store.dispatch(new fromDashboard.Retrieve(dashboards))));
  }
}
