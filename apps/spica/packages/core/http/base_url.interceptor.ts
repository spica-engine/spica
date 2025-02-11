import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpParams,
  HttpRequest
} from "@angular/common/http";
import {Observable} from "rxjs";
import {BaseUrlCollection} from "./base_url";
import {HttpParameterCodec} from "@angular/common/http";

export class ParamEncoder implements HttpParameterCodec {
  encodeKey(key: string): string {
    return encodeURIComponent(key);
  }
  encodeValue(value: string): string {
    return encodeURIComponent(value);
  }
  decodeKey(key: string): string {
    return decodeURIComponent(key);
  }
  decodeValue(value: string) {
    return decodeURIComponent(value);
  }
}

export class BaseUrlInterceptor implements HttpInterceptor {
  encoder: HttpParameterCodec = new ParamEncoder();

  constructor(private baseCollection: BaseUrlCollection) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    request = this.encodeParams(request);

    // Searching for a link like "api:/mypath"
    const regExp = /^([^0-9][a-zA-Z0-9_]*):?/;

    if (regExp.test(request.url)) {
      const matchResult = request.url.match(regExp);
      const base = matchResult[1];
      if (!(base in this.baseCollection)) {
        console.warn(
          `BaseUrlInterceptor: The base url '${base}' could not found in any base collection. (Url: ${request.url})`
        );
        return next.handle(
          request.clone({
            headers: request.headers.append("X-Not-Api", "true")
          })
        );
      }
      const url = this.baseCollection[base] + request.url.replace(regExp, "");
      return next.handle(request.clone({url: url}));
    }
    return next.handle(request);
  }

  private encodeParams(request: HttpRequest<any>) {
    const encodedParams = new HttpParams({
      fromString: request.params.toString(),
      encoder: this.encoder
    });

    return request.clone({params: encodedParams});
  }
}
