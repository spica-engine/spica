import {Injectable} from "@angular/core";
import {ActivityFilter, Activity} from "../interface";
import {HttpClient} from "@angular/common/http";
import {BucketService, BucketDataService} from "@spica-client/bucket";
import {ApiKeyService} from "@spica-client/passport/services/apikey.service";
import {IdentityService, PolicyService, PassportService} from "@spica-client/passport";
import {map} from "rxjs/operators";
import {FunctionService} from "@spica-client/function/services/function.service";
import {StorageService} from "@spica-client/storage";
import {of} from "rxjs";

@Injectable()
export class ActivityService {
  constructor(
    private http: HttpClient,
    private bucket: BucketService,
    private bucketData: BucketDataService,
    private passport: PassportService,
    private apiKey: ApiKeyService,
    private identity: IdentityService,
    private policy: PolicyService,
    private func: FunctionService,
    private storage: StorageService
  ) {}

  private resetTimezoneOffset(date: Date) {
    return new Date(date.setMinutes(date.getMinutes() - date.getTimezoneOffset()));
  }

  get(filter: ActivityFilter) {
    const params: any = {};

    if (filter.identifier) {
      params.identifier = filter.identifier;
    }

    if (filter.action.length) {
      params.action = filter.action;
    }

    if (filter.date.begin) {
      params.begin = this.resetTimezoneOffset(new Date(filter.date.begin)).toISOString();
    }

    if (filter.date.end) {
      params.end = this.resetTimezoneOffset(new Date(filter.date.end)).toISOString();
    }

    if (filter.resource.$all.length) {
      const resource = JSON.parse(JSON.stringify(filter.resource));

      if (!filter.resource.$in.length) {
        delete resource.$in;
      }

      params.resource = JSON.stringify(resource);
    }

    if (filter.limit) {
      params.limit = filter.limit;
    }

    params.skip = filter.skip;

    return this.http.get<Activity[]>("api:/activity", {params});
  }

  getBuckets() {
    return this.bucket.getBuckets();
  }

  getDocumentIds(group: string, module: string) {
    switch (group) {
      case "passport":
        switch (module) {
          case "apikey":
            return this.apiKey
              .getAll(0, 0, {_id: -1})
              .pipe(map(result => result.data.map(apikey => apikey._id)));
          case "identity":
            return this.identity
              .find()
              .pipe(map(identities => identities.map(identity => identity._id)));
          case "policy":
            return this.policy.find().pipe(map(result => result.data.map(policy => policy._id)));
        }
        break;
      case "bucket":
        return this.bucketData
          .find(module)
          .pipe(map(result => result.data.map(bucketData => bucketData._id)));
      case "":
        switch (module) {
          case "bucket":
            return this.bucket.getBuckets().pipe(map(bucket => bucket.map(bucket => bucket._id)));
          case "storage":
            return this.storage.getAll().pipe(map(result => result.map(strObj => strObj._id)));
          case "function":
            return this.func.getFunctions().pipe(map(fns => fns.map(fn => fn._id)));
          case "preference":
            return of(["bucket", "passport"]);
        }
    }
  }

  checkAllowed(action: string) {
    return this.passport.checkAllowed(action);
  }

  deleteActivities(activities: Activity[]) {
    return this.http.request("delete", "api:/activity", {
      body: activities.map(activity => activity._id)
    });
  }
}
