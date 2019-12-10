import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Observable} from "rxjs/Observable";
import {tap} from "rxjs/operators";
import {PassportService} from "./passport.service";

@Injectable({
  providedIn: "root"
})
export class AuthorizationInterceptor implements HttpInterceptor {
  constructor(private passport: PassportService) {}
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.passport.token) {
      request = request.clone({setHeaders: {Authorization: `${this.passport.token}`}});
    }
    return next.handle(request).pipe(
      tap({
        error: (err: any) => {
          if (err instanceof HttpErrorResponse && err.status === 401) {
            // TODO: Write a proper http error handler
          }
        }
      })
    );
  }
}
