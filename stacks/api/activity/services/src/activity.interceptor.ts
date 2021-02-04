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
import {Predict} from "./interface";
import {createActivity} from "./activity";

export abstract class ActivityInterceptor implements NestInterceptor {
  constructor(private service: ActivityService, private predict: Predict) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.service) {
      !process.env.TEST_TARGET &&
        console.log(
          `In order to use "Activity", please, ensure to import ActivityModule in each place where activity() is being used. Otherwise, activity won't work correctly.`
        );
      return next.handle();
    }
    return next.handle().pipe(
      tap(res => {
        const activities = createActivity(context.switchToHttp().getRequest(), res, this.predict);
        if (activities.length) {
          const _ = this.service.insert(activities);
        }
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
