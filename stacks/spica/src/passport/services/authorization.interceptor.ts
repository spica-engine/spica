import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from "@angular/common/http";
import {Inject, Injectable} from "@angular/core";
import {Observable, Subject, of} from "rxjs";
import {catchError, debounceTime, filter, switchMap, take, tap} from "rxjs/operators";
import {PassportService} from "./passport.service";
import {environment} from "environments/environment";
import {Router} from "@angular/router";
import {MatSnackBar} from "@angular/material/snack-bar";
import {SnackbarComponent} from "@spica-client/core/layout/snackbar/snackbar.component";
import {SnackbarError} from "@spica-client/core/layout/snackbar/interface";
import { PASSPORT_OPTIONS, PassportOptions } from "../interfaces/passport";

@Injectable({
  providedIn: "root"
})
export class AuthorizationInterceptor implements HttpInterceptor {
  private refreshTokenSubject = new Subject<string>();
  
  constructor(
    private _snackBar: MatSnackBar,
    private passport: PassportService,
    private router: Router,
    @Inject(PASSPORT_OPTIONS) private options: PassportOptions
  ) {
    this.refreshTokenSubject.pipe(
      debounceTime(3000),
      filter(requestURL => requestURL !== `${this.options.url}/passport/access-token`),
      switchMap(() => this.passport.getAccessToken().pipe(
        take(1),
        catchError(error => {
          this.handleRefreshTokenError(error);
          return of(null);
        })
      ))
    ).subscribe(
      token => {
        if(!token) return;
        this.passport.onTokenRecieved(token)
      }
    );
  }
  
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.passport.token && !request.headers.has("X-Not-Api")) {
      this.refreshTokenSubject.next(request.url);
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

  handleRefreshTokenError(error) {
    this.passport.logout();
    this.router.navigate(["passport/identify"]);
    console.error(error)
    this._snackBar.openFromComponent(SnackbarComponent, {
      data: {
        status: error.status,
        message: "You've been inactive for a while, must log in again.",
      } as SnackbarError,
      duration: 5000
    })
  }
}
