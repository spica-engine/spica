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
import {Action, Predict} from "./interface";

export function activity(predict: Predict): Type<any> {
  class MixinActivityInterceptor implements NestInterceptor {
    constructor(@Optional() private service: ActivityService) {}
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      if (!this.service) {
        return next.handle();
      }
      return next.handle().pipe(
        tap(res => {
          try {
            const req = context.getArgByIndex(0);
            const action = getAction(req.method);
            const identifier = getUser(req.user);
            const resource = predict(action, req, res);
            const activity = {identifier, action, resource};
            this.service.insertOne(activity);
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
  const key = Object.keys(Action).findIndex(val => val === action);
  return Object.values(Action)[key];
}

export function getUser(user: any): string {
  return user ? user._id : undefined;
}
