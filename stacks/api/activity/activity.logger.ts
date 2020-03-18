import {NestInterceptor, ExecutionContext, CallHandler} from "@nestjs/common";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";

export interface Activity {
  module: string;
  action: string;
  identifier: string;
  documentId: string;
  date: Date;
}

export class ActivityLogger implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(res => {
        const request = context.getArgByIndex(0);

        if (!request || !this.isActivityLog(request.method)) {
          console.log("This request isn't exist in the activity log scope");
          return;
        }

        const activity: Activity = {
          action: request.method,
          module: request.url,
          identifier: request.user ? request.user.identifier : undefined,
          documentId: res ? res._id : undefined,
          date: new Date()
        };

        console.log(activity);
      })
    );
  }

  isActivityLog(method: string): boolean {
    if (
      method == "POST" ||
      method == "PUT" ||
      method == "DELETE" // || method == "PATCH"
    )
      return true;
    else return false;
  }
}
