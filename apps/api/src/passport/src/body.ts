import {CallHandler, ExecutionContext, mixin, Type} from "@nestjs/common";
import {urlencoded} from "body-parser";
import {Observable} from "rxjs";
import {switchMapTo} from "rxjs/operators";

abstract class __UrlEncodedBody {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const [req, res] = context.getArgs();
    return new Observable(observer => {
      const parser = urlencoded({extended: false});
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

export function UrlEncodedBodyParser(): Type<any> {
  return mixin(class extends __UrlEncodedBody {});
}
