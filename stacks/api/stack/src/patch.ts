import {
    CallHandler,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Inject,
    mixin,
    Type
  } from "@nestjs/common";
  import {json} from "body-parser";
  import {Observable} from "rxjs";
  import {switchMapTo} from "rxjs/operators";

  
abstract class __PatchBody {

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      const [req, res] = context.getArgs();
      return new Observable(observer => {

        const parser = json({
            type: [
                'application/json-patch+json',
                'application/merge-patch+json'
            ]
        });
        parser(req, res, error => {
          if (error) {
            return observer.error(error);
          }
          observer.next();
          observer.complete();
        });

      }).pipe(switchMapTo(next.handle()));
    }
  }

export function PatchBodyParser(): Type<any> {
    return mixin(class extends __PatchBody {});
  }
  