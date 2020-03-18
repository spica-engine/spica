import {NestInterceptor, ExecutionContext, CallHandler} from "@nestjs/common";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";
import {Activity, Action} from "@spica-server/activity";

export class BucketActivityLogger implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(response => {
        const request = context.getArgByIndex(0);
        if (!request || !this.inActivityLogScope(request.method)) {
          console.log("This request isn't exist in the activity log scope");
          return;
        }
        const activity = this.createActivity(request, response);
        const isValidActivity = this.checkActivity(activity);

        //write this activity to db or return
        console.log(isValidActivity ? activity : "Invalid Activity.");
      })
    );
  }

  inActivityLogScope(method: string): boolean {
    return method == "POST" || method == "PUT" || method == "DELETE" // || method == "PATCH"
      ? true
      : false;
  }

  createActivity(request: any, response: any): Activity {
    const activity: Activity = {
      action: Object.values(Action)[Object.keys(Action).findIndex(val => val === request.method)],
      module: undefined,
      identifier: request.user ? request.user.identifier : undefined,
      documentId: undefined,
      date: new Date()
    };

    const params = request.params;
    if (params) {
      if (params.bucketId) {
        activity.module = `BUCKET_${params.bucketId}`;
        activity.documentId =
          activity.action == Action.POST
            ? response._id
              ? response._id
              : undefined
            : params.documentId
            ? params.documentId
            : undefined;
      } else {
        activity.module = "BUCKET";
        activity.documentId =
          activity.action == Action.POST
            ? response._id
              ? response._id
              : undefined
            : params.id
            ? params.id
            : undefined;
      }
    }
    return activity;
  }

  checkActivity(activity: Activity): boolean {
    return Object.values(activity).every(val => val != undefined);
  }
}
