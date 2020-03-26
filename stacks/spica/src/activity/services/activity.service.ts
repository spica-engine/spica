import {Injectable} from "@angular/core";
import {ActivityFilter, Activity} from "../interface";
import {HttpClient, HttpParams} from "@angular/common/http";
import {map} from "rxjs/operators";

@Injectable()
export class mockActivityService {
  // activities: Activity[] = [];
  // createRandomActivities() {
  //   let availables = getAvailableFilters();
  //   let randomActivities: Activity[] = [];
  //   for (let index = 0; index < 200; index++) {
  //     randomActivities.push({
  //       _id: ObjectId.createFromTime(new Date().getTime()).toHexString(),
  //       action:
  //         availables.actions[Math.floor(Math.random() * Math.floor(availables.actions.length))],
  //       resource: {
  //         name:
  //           availables.modules[Math.floor(Math.random() * Math.floor(availables.modules.length))],
  //         documentId: [new ObjectId().toHexString()]
  //       },
  //       identifier: this.createIdentifier()
  //     });
  //   }
  //   return randomActivities;
  // }
  // createIdentifier() {
  //   const identifiers = ["Tuna", "Ahmet", "Mehmet", "Ayşe", "Hasan", "Veli", "Necmi"];
  //   return identifiers[Math.floor(Math.random() * Math.floor(identifiers.length))];
  // }
  // constructor() {
  //   this.activities = this.createRandomActivities();
  // }
  // get(
  //   filter: ActivityFilter = {
  //     identifier: undefined,
  //     actions: [],
  //     date: {
  //       begin: undefined,
  //       end: undefined
  //     },
  //     modules: [],
  //     limit: undefined,
  //     skip: undefined
  //   }
  // ): Observable<Activity[]> {
  //   let filteredActivities: Activity[] = JSON.parse(JSON.stringify(this.activities));
  //   if (filter.identifier) {
  //     filteredActivities = this.activities.filter(activity =>
  //       activity.identifier.toLowerCase().startsWith(filter.identifier.toLowerCase())
  //     );
  //   }
  //   if (filter.date && filter.date.begin && filter.date.end) {
  //     filteredActivities = this.activities.filter(
  //       activity => activity._id >= filter.date.begin && activity.date <= filter.date.end
  //     );
  //   }
  //   if (filter.actions && filter.actions.length >= 1) {
  //     filteredActivities = filteredActivities.filter(activity =>
  //       filter.actions.includes(activity.action)
  //     );
  //   }
  //   if (filter.modules && filter.modules.length >= 1) {
  //     filteredActivities = filteredActivities.filter(activity =>
  //       filter.modules.includes(activity.module)
  //     );
  //   }
  //   if (filter.skip) {
  //     filteredActivities = filteredActivities.filter((activity, index) => index >= filter.skip);
  //   }
  //   if (filter.limit) {
  //     filteredActivities = filteredActivities.filter((activity, index) => index < filter.limit);
  //   }
  //   return of(filteredActivities);
  // }
}

@Injectable()
export class ActivityService {
  constructor(private http: HttpClient) {}
  get(filter: ActivityFilter) {
    let params = new HttpParams();

    //clear undefined keys
    switch (filter.action) {
      case "INSERT":
        params.set("action", "1");
        break;
      case "UPDATE":
        params.set("action", "2");
        break;
      case "DELETE":
        params.set("action", "3");
        break;
      default:
        break;
    }

    if (filter.date) {
      if (filter.date.begin) {
        params.set("begin", filter.date.begin.toString());
      }
      if (filter.date.end) {
        params.set("end", filter.date.end.toString());
      }
    }

    //find how to send json params on http request

    if (filter.resource) {
      params.set("resource", JSON.stringify(filter.resource));
    }

    console.log(params);

    return this.http.get<Activity[]>("api:/activity", {params});
  }

  getDocuments(moduleName: string, documentId?: string) {
    moduleName = moduleName.toLowerCase();
    let path = "api:/";
    switch (moduleName) {
      case "apikey":
        path = `${path}passport/${moduleName}`;
        break;
      case "policy":
        path = `${path}passport/${moduleName}`;
        break;
      case "identity":
        path = `${path}passport/${moduleName}`;
        break;
      case "passport-settings":
        path = `${path}preference/passport`;
        break;
      case "bucket-settings":
        path = `${path}preference/bucket`;
        break;
      case "bucket-data":
        path = `${path}bucket/${documentId}/data`;
        break;
      default:
        path = `${path}${moduleName}`;
        break;
    }
    return this.http.get(path).pipe(
      map(response => {
        //cause of compiler error such as data is not key
        let _response: any = response;
        return Array.isArray(response)
          ? response.map(item => item._id)
          : _response.data
          ? _response.data.map(item => item._id)
          : [];
      })
    );
  }
}
