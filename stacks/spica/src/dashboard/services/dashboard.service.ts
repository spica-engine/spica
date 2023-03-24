import {HttpClient, HttpParams} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Store} from "@ngrx/store";
import {Observable} from "rxjs";
import {tap,map} from "rxjs/operators";
import {Dashboard} from "../interfaces";
import * as fromDashboard from "../state/dashboard.reducer";
import {example} from "./example-code";

@Injectable()
export class DashboardService {
   copiedDashboards = new Map<string, Dashboard>();
  constructor(private http: HttpClient, private store: Store<fromDashboard.State>) {}

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

  copiedDeneme(){

   console.log(this.copiedDashboards);

    // return this.store.select(fromDashboard.selectEntity(id));
  }

  findOne(id: string): Observable<Dashboard> {
  

    return this.store.select(fromDashboard.selectEntity(id)).pipe(map((dashboard) => {
      const copiedDashboard = this.copiedDashboards.get(id);
      if(!copiedDashboard){
        return dashboard;
      }
         dashboard.components = dashboard.components.map((originalComponent)=>{
        const matchedComponent = copiedDashboard.components.find( (copiedComponent) =>{
          return copiedComponent.name == originalComponent.name
         } 
         )
         originalComponent.ratio = matchedComponent.ratio;
         return originalComponent;
      })

      return dashboard;
    }))
  }

  executeComponent(url: string, filter: {[key: string]: string}): Observable<any> {
    const params = new HttpParams({fromObject: {filter: JSON.stringify(filter)}});
    return this.http.get(url, {params: params});
  }

  update(dashboard: Dashboard) {
    this.copiedDashboards.set(dashboard._id, JSON.parse(JSON.stringify(dashboard)));
    dashboard.components = dashboard.components.map((component)=>{
      delete component.ratio; 
      return component;
    })

    const id = dashboard._id;
    delete dashboard._id;

    return this.http
      .put<Dashboard>(`api:/dashboard/${id}`, dashboard)
      .pipe(
        tap(updatedDashboard =>
          this.store.dispatch(new fromDashboard.Update(dashboard._id, updatedDashboard))
        )
      );
  }

  insert(dashboard: Dashboard) {
    this.copiedDashboards.set(dashboard._id, JSON.parse(JSON.stringify(dashboard)));
    dashboard.components = dashboard.components.map((component)=>{
      delete component.ratio; 
      return component;
    })
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
