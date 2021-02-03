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
import {Action, Predict, Activity} from "./interface";
import {ObjectId} from "@spica-server/database";

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
    return next.handle().pipe(tap(res => createActivity(context, res, this.predict, this.service)));
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

export function getIdentifier(user: any) {
  const userId = user ? user._id : undefined;
  return ObjectId.isValid(userId) ? new ObjectId(userId) : undefined;
}

export function getUserId(user: any): string {
  return user ? user._id : undefined;
}

export async function createActivity(
  context: ExecutionContext,
  res: any,
  predict: Predict,
  service: ActivityService
) {
  const req = context.switchToHttp().getRequest();
  const identifier = getIdentifier(req.user);
  if (!identifier) {
    console.log(`Identifier was not sent.`);
    return;
  }
  const action = getAction(req.method);
  const activities: Activity[] = predict({identifier, action}, req, res).map(activity => {
    return {...activity, created_at: new Date()};
  });

  await service.insertMany(activities);
}
