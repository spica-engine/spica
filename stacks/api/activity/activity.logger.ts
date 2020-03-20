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

export function createActivity(
  req: any,
  res: any,
  controllerDetails: ControllerDetails
) {
  let activity: Activity = {
    resource: undefined,
    identifier: req.user ? (req.user.identifier ? req.user.identifier : undefined) : undefined,
    action: undefined
  };
  activity.action = Object.values(Action)[Object.keys(Action).findIndex(val => val === req.method)];

  const params = req.params;

  let documentId: string[] = [];

  if (activity.action == Action.POST) {
    documentId = Array.isArray(res)
      ? res.map(item => item[controllerDetails.documentIdKey])
      : [res[controllerDetails.documentIdKey]];
  } else {
    documentId = params[controllerDetails.documentIdKey]
      ? [params[controllerDetails.documentIdKey]]
      : Array.isArray(req.body)
      ? req.body.map(b => b[controllerDetails.documentIdKey])
      : [req.body[controllerDetails.documentIdKey]];
  }

  let moduleName = controllerDetails.moduleName;

  activity.resource = {
    documentId,
    moduleName
  };

  if (controllerDetails.moduleIdKey)
    activity.resource = {...activity.resource, moduleId: params[controllerDetails.moduleIdKey]};

  return activity;
}

// export interface testActivity {
//   resource: testResource;
//   action: Action;
//   identifier: string;
// }

// export interface testResource {
//   moduleName: string;
//   moduleId?: string;
//   documentId: string[];
// }

// export interface testControllerInfo {
//   action: Action;
//   resource: testControllerResource;
// }

// export interface testControllerResource {
//   moduleName: string;
//   moduleId?: string;
//   documentId: string;
// }

// export function testCreateActivity(
//   req: any,
//   res: any,
//   givenActivity: testActivity,
//   info: testControllerInfo
// ) {
//   let activity: testActivity = JSON.parse(JSON.stringify(givenActivity));
//   activity.action = info.action;

//   const params = req.params;
//   const body = req.body;

//   activity.resource = {
//     moduleName: info.resource.moduleName,
//     documentId:
//       activity.action == Action.POST
//         ? Array.isArray(res)
//           ? res.map(r => r._id)
//           : [res._id]
//         : params[info.resource.documentId]
//         ? [params[info.resource.documentId]]
//         : Array.isArray(body)
//         ? body.map(b => b[info.resource.documentId])
//         : [body[info.resource.documentId]]
//   };

//   if (info.resource.moduleId) activity.resource.moduleId = params[info.resource.moduleId];
//   return activity;
// }
// export function createActivity(
//   module: string,
//   preActivity: Activity,
//   req: any,
//   res: any
// ): Activity {
//   const action = Object.values(Action)[Object.keys(Action).findIndex(val => val === req.method)];
//   let activity: Activity = {
//     ...preActivity,
//     resource: [module],
//     verb: action
//   };
//   const params = req.params;
//   if (module == "BUCKET-DATA") {
//     activity.resource.push(params ? (params.bucketId ? params.bucketId : undefined) : undefined);
//     if (action == Action.POST) {
//       activity.resource.push(res._id ? res._id : undefined);
//     } else {
//       activity.resource.push(
//         params ? (params.documentId ? params.documentId : undefined) : undefined
//       );
//     }
//   } else if (module == "PREFERENCE") {
//     activity.resource.push(params.scope ? params.scope : undefined);
//   } else {
//     if (action == Action.POST) {
//       activity.resource.push(res._id ? res._id : undefined);
//     } else {
//       activity.resource.push(params ? (params.id ? params.id : undefined) : undefined);
//     }
//   }
//   return activity;
// }
