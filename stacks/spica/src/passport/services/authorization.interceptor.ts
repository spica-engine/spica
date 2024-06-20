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
import {environment} from "environments/environment";
import {Router} from "@angular/router";
import {MatSnackBar} from "@angular/material/snack-bar";
import {SnackbarComponent} from "@spica-client/core/layout/snackbar/snackbar.component";
import {SnackbarError} from "@spica-client/core/layout/snackbar/interface";

@Injectable({
  providedIn: "root"
})
export class AuthorizationInterceptor implements HttpInterceptor {
  constructor(
    private _snackBar: MatSnackBar,
    private passport: PassportService,
    private router: Router,
  ) {}
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
    if(requestURL != `${environment.api}/passport/access-token`){
      this.passport.getAccessToken()
      .pipe(
        take(1),
      )
      .subscribe(
        r => {
          this.passport.onTokenRecieved(r);
        },
        r => {
          this.passport.logout();
          this.router.navigate(["passport/identify"]);
          console.error(r)
          this._snackBar.openFromComponent(SnackbarComponent, {
            data: {
              status: r.status,
              message: "You've been inactive for a while, must log in again.",
            } as SnackbarError,
            duration: 5000
          })
        }
      );
    }
  }
}
