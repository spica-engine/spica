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
import {Activity, Action, ControllerDetails} from "./interface";

export function ActivityInterceptor(controllerDetails: ControllerDetails): Type<any> {
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
            let activity = createActivity(req, data, controllerDetails);
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

export function createActivity(req: any, res: any, controllerDetails: ControllerDetails) {
  //set user first
  let activity: Activity = {
    resource: undefined,
    identifier: req.user ? (req.user.identifier ? req.user.identifier : undefined) : undefined,
    action: undefined
  };

  //set action type
  activity.action = Object.values(Action)[Object.keys(Action).findIndex(val => val === req.method)];

  //set documentId if from req.params, req.body or res with using given keys from controllers
  const params = req.params;
  let documentId: string[] = [];

  switch (activity.action) {
    case Action.POST:
      documentId = Array.isArray(res)
        ? res.map(item => item[controllerDetails.documentIdKey].toString())
        : [res[controllerDetails.documentIdKey].toString()];
      break;
    case Action.PUT:
      documentId = params[controllerDetails.documentIdKey]
        ? [params[controllerDetails.documentIdKey]]
        : Array.isArray(req.body)
        ? req.body.map(item => item[controllerDetails.documentIdKey])
        : [req.body[controllerDetails.documentIdKey]];
      break;
    case Action.DELETE:
      documentId = params[controllerDetails.documentIdKey]
        ? [params[controllerDetails.documentIdKey]]
        : Array.isArray(req.body)
        ? req.body
        : [req.body];
      break;
  }

  //set module name
  let moduleName = controllerDetails.moduleName;

  //set resource
  activity.resource = {
    documentId,
    moduleName
  };

  //add moduleid if it has
  //it's usefull for bucket-data module
  if (controllerDetails.moduleIdKey)
    activity.resource = {...activity.resource, moduleId: params[controllerDetails.moduleIdKey]};

  return activity;
}
