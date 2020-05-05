import {
  CallHandler,
  ExecutionContext,
  mixin,
  NestInterceptor,
  Optional,
  Type
} from "@nestjs/common";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";
import {ActivityService} from "./activity.service";
import {Action, Activity, Predict} from "./interface";

export abstract class ActivityInterceptor implements NestInterceptor {
  constructor(private service: ActivityService, private predict: Predict) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.service) {
      console.log(
        `In order to use "Activity", please, ensure to import ActivityModule in each place where activity() is being used. Otherwise, activity won't work correctly.`
      );
      return next.handle();
    }
    return next.handle().pipe(
      tap(res => {
        const req = context.switchToHttp().getRequest();
        const identifier = getUser(req.user);
        if (!identifier) {
          console.log(`Identifier was not sent.`);
          return;
        }
        const action = getAction(req.method);
        const activities: Activity[] = this.predict({identifier, action}, req, res);

        this.service.insertMany(activities);
      })
    );
  }
}

export function activity(predict: Predict): Type<any> {
  class MixinActivityInterceptor extends ActivityInterceptor {
    constructor(@Optional() service: ActivityService) {
      super(service, predict);
    }
  }
  return mixin(MixinActivityInterceptor);
}

export function getAction(action: string): Action {
  return Action[action];
}

export function getUser(user: any): string {
  return user ? user._id : undefined;
}
