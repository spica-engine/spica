import {Injectable} from "@angular/core";
import {ActivityFilter, Activity} from "../interface";
import {HttpClient} from "@angular/common/http";

@Injectable()
export class ActivityService {
  constructor(private http: HttpClient) {}

  private resetTimezoneOffset(date: Date) {
    return new Date(date.setMinutes(date.getMinutes() - date.getTimezoneOffset()));
  }

  get(filter: ActivityFilter) {
    let params: any = {};

    if (filter.identifier) params.identifier = filter.identifier;

    if (filter.action && filter.action.length > 0) {
      params.action = [];
      for (let action of filter.action) {
        switch (action) {
          case "Insert":
            params.action.push("1");
            break;
          case "Update":
            params.action.push("2");
            break;
          case "Delete":
            params.action.push("3");
            break;
          default:
            break;
        }
      }
    }

    if (filter.date) {
      if (filter.date.begin) {
        params.begin = this.resetTimezoneOffset(new Date(filter.date.begin)).toISOString();
      }
      if (filter.date.end) {
        params.end = this.resetTimezoneOffset(new Date(filter.date.end)).toISOString();
      }
    }

    if (filter.resource) {
      if (filter.resource.name) {
        params.resource = {
          name: filter.resource.name
        };
      }
      if (filter.resource.documentId) {
        params.resource = {
          ...params.resource,
          documentId: filter.resource.documentId.length ? filter.resource.documentId : undefined
        };
      }
    }

    if (params.resource) params.resource = JSON.stringify(params.resource);

    if (filter.limit) params.limit = filter.limit;

    if (filter.skip) params.skip = filter.skip;

    return this.http.get<Activity[]>("api:/activity", {params});
  }

  getDocuments(collection: string) {
    let collectionName = collection;
    switch (collection) {
      case "bucket":
        collectionName = "buckets";
        break;
      case "policy":
        collectionName = "policies";
        break;
    }
    return this.http.get<string[]>(`api:/activity/collection/${collectionName}`);
  }

  deleteActivities(activities: Activity[]) {
    return this.http.request("delete", "api:/activity", {
      body: activities.map(activity => activity._id)
    });
  }
}
