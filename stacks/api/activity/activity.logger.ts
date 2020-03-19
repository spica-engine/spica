import {
  NestInterceptor,
  Optional,
  ExecutionContext,
  CallHandler,
  mixin,
  Type
} from "@nestjs/common";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";
import {ActivityService} from "./activity.service";
import {Activity, Predict, Action} from "./interface";

export function ActivityInterceptor(predict: Predict, module: string): Type<any> {
  class MixinActivityInterceptor implements NestInterceptor {
    constructor(@Optional() private service: ActivityService) {}
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      if (!this.service) {
        console.log("service couldn't find");
        return next.handle();
      }
      return next.handle().pipe(
        tap(data => {
          try {
            const req = context.getArgByIndex(0);
            let activity: Activity = {
              resource: [],
              identifier: req.user
                ? req.user.identifier
                  ? req.user.identifier
                  : undefined
                : undefined,
              verb: undefined
            };
            activity = predict(module, activity, req, data);
            this.service.insertOne(activity).then(res => console.log(res));
          } catch (error) {
            console.log(error);
          }
        })
      );
    }
  }
  return mixin(MixinActivityInterceptor);
}

export function createActivity(
  module: string,
  preActivity: Activity,
  req: any,
  res: any
): Activity {
  const action = Object.values(Action)[Object.keys(Action).findIndex(val => val === req.method)];
  let activity: Activity = {
    ...preActivity,
    resource: [module],
    verb: action
  };
  const params = req.params;
  if (module == "BUCKET-DATA") {
    activity.resource.push(params ? (params.bucketId ? params.bucketId : undefined) : undefined);
    if (action == Action.POST) {
      activity.resource.push(res._id ? res._id : undefined);
    } else {
      activity.resource.push(
        params ? (params.documentId ? params.documentId : undefined) : undefined
      );
    }
  } else if (module == "PREFERENCE") {
    activity.resource.push(params.scope ? params.scope : undefined);
  } else {
    if (action == Action.POST) {
      activity.resource.push(res._id ? res._id : undefined);
    } else {
      activity.resource.push(params ? (params.id ? params.id : undefined) : undefined);
    }
  }
  return activity;
}
