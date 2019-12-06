import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from "@angular/common/http";
import {Observable} from "rxjs";
import {BaseUrlCollection} from "./base_url";

export class BaseUrlInterceptor implements HttpInterceptor {
  constructor(private baseCollection: BaseUrlCollection) {}
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Searching for a link like "api:/mypath"
    const regExp = /^([^0-9][a-zA-Z0-9_]*):?/;

    if (regExp.test(request.url)) {
      const matchResult = request.url.match(regExp);
      const base = matchResult[1];
      if (!(base in this.baseCollection)) {
        console.warn(
          `BaseUrlInterceptor: The base url '${base}' could not found in any base collection. (Url: ${request.url})`
        );
        return next.handle(request);
      }
      const url = this.baseCollection[base] + request.url.replace(regExp, "");
      return next.handle(request.clone({url: url}));
    }
    return next.handle(request);
  }
}
