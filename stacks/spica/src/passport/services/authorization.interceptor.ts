import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {take, tap} from "rxjs/operators";
import {PassportService} from "./passport.service";
import { environment } from "environments/environment";

@Injectable({
  providedIn: "root"
})
export class AuthorizationInterceptor implements HttpInterceptor {
  constructor(private passport: PassportService) {}
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.passport.token && !request.headers.has("X-Not-Api")) {
      this.refreshToken(request.url);
      request = request.clone({setHeaders: {Authorization: `${this.passport.token}`}});
    }
    return next.handle(request.clone({headers: request.headers.delete("X-Not-Api")})).pipe(
      tap({
        error: (err: any) => {
          if (err instanceof HttpErrorResponse && err.status === 401) {
            // TODO: Write a proper http error handler
          }
        }
      })
    );
  }
  refreshToken(requestURL: string){
    if(requestURL != `${environment.api}/passport/refresh-token`){
      const lastReqDate = this.passport.getNextTokenRefreshDate();
      if(new Date(lastReqDate) < new Date()){
        this.passport.setNextTokenRefreshDate();
        this.passport.refreshToken()
        .pipe(
          take(1),
        )
        .subscribe(
          r => {
            this.passport.onTokenRecieved(r);
          }
        );
      }
    }
  }
}
