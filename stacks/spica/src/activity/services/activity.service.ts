import {Injectable} from "@angular/core";
import {ActivityFilter, Activity} from "../interface";
import {HttpClient} from "@angular/common/http";
import {BucketService} from "@spica-client/bucket";
import {ApiKeyService} from "@spica-client/passport/services/apikey.service";
import {IdentityService, PolicyService} from "@spica-client/passport";
import {map, catchError} from "rxjs/operators";
import {FunctionService} from "@spica-client/function/function.service";
import {StorageService} from "@spica-client/storage";
import {PreferencesService} from "@spica-client/core";
import {of} from "rxjs";

@Injectable()
export class ActivityService {
  constructor(
    private http: HttpClient,
    private bucket: BucketService,
    private apiKey: ApiKeyService,
    private identity: IdentityService,
    private policy: PolicyService,
    private func: FunctionService,
    private storage: StorageService,
    private preference: PreferencesService
  ) {}

  private resetTimezoneOffset(date: Date) {
    return new Date(date.setMinutes(date.getMinutes() - date.getTimezoneOffset()));
  }

  get(filter: ActivityFilter) {
    let params: any = {};

    if (filter.identifier) params.identifier = filter.identifier;

    if (filter.action && filter.action.length > 0) {
      params.action = filter.action;
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

  // getDocuments(collection: string) {
  //   let collectionName = collection;
  //   switch (collection) {
  //     case "bucket":
  //       collectionName = "buckets";
  //       break;
  //     case "policy":
  //       collectionName = "policies";
  //       break;
  //   }
  //   return this.http.get<string[]>(`api:/activity/collection/${collectionName}`);
  // }

  getBuckets() {
    return this.bucket.getBuckets();
  }

  showDocuments(module: string, document: string) {
    switch (module) {
      case "passport":
        switch (document) {
          case "apikey":
            //endpoint should return all without skip or limit
            break;
          case "identity":
            //endpoint should return all without skip or limit
            break;
          case "policy":
            return this.policy.find().pipe(
              catchError(_ => of(undefined)),
              map(result => result.data.map(policy => policy._id))
            );
        }
        break;
      case "bucket":
        break;
      case "function":
        return this.func.getFunctions().pipe(map(fns => fns.map(fn => fn._id)));
      case "storage":
        break;
      //endpoint should return all without skip or limit
      case "preference":
        break;
      //no need to get documents
    }
  }

  deleteActivities(activities: Activity[]) {
    return this.http.request("delete", "api:/activity", {
      body: activities.map(activity => activity._id)
    });
  }
}
