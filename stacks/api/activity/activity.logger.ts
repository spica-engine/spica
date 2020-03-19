import {NestInterceptor, ExecutionContext, CallHandler, Injectable} from "@nestjs/common";
import {Activity} from ".";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";

export class ActivityInterceptor implements NestInterceptor {
  activityCreater: (req: any, res: any) => Activity;
  constructor(activityCreater: (req, res) => Activity) {
    this.activityCreater = activityCreater;
  }
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(res => {
        if (!this.activityCreater) {
          console.log("this feature is disabled.");
          return;
        }
        try {
          const req = context.getArgByIndex(0);
          const activity = this.activityCreater(req, res);
          //write this activity to db
          //this.activityService.insertOne(activity).then(res => console.log(res));
        } catch (error) {
          console.log(error);
        }
      })
    );
  }
}
