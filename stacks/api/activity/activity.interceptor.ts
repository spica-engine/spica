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
import {Activity, Action, Predict} from "./interface";

export function ActivityInterceptor(predict: Predict): Type<any> {
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
            let action = getAction(req.method);
            let identifier = getUser(req.user);
            let resource = predict(action, req, data);
            this.service
              .insertOne({identifier, action, resource})
              .then(res => console.log(JSON.stringify(res, null, 4)));
          } catch (error) {
            console.log(error);
          }
        })
      );
    }
  }
  return mixin(MixinActivityInterceptor);
}

export function getAction(action: string): Action {
  return Object.values(Action)[Object.keys(Action).findIndex(val => val === action)];
}

export function getUser(user: any): string {
  return user ? user.identifier : undefined;
}
