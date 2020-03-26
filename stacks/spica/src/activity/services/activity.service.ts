import {Injectable} from "@angular/core";
import {ActivityFilter, Activity} from "../interface";
import {HttpClient} from "@angular/common/http";

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
    let params = JSON.parse(JSON.stringify(filter));
    //clear undefined keys
    Object.keys(params).forEach(key => params[key] == null && delete params[key]);
    switch (params.action) {
      case "INSERT":
        params.action = "1";
        break;
      case "UPDATE":
        params.action = "2";
        break;
      case "DELETE":
        params.action = "3";
        break;
      default:
        break;
    }

    if (params.resource) {
      if (params.resource.name) {
        params["resource.name"] = params.resource.name;
      }
      if (params.resource.documentId) params["resource.documentId"] = params.resource.documentId;
      //add sub resources before delete it
      delete params.resource;
    }

    if (params.date) {
      if (params.date.begin) {
        params["begin"] = params.date.begin;
      }
      if (params.date.end) {
        params["end"] = params.date.end;
      }
      delete params.date;
    }

    console.log(params);

    return this.http.get<Activity[]>("api:/activity", {params: params as any});
  }
}
