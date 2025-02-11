import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from "@angular/common/http";
import {Inject, Injectable} from "@angular/core";
import {Router} from "@angular/router";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";
import {SnackbarComponent} from "./snackbar/snackbar.component";
import {SnackbarError} from "./snackbar/interface";
import {MatSnackBar} from "@angular/material/snack-bar";
import {IgnoreHttpError, IGNORE_HTTP_ERRORS} from "./config";

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    public router: Router,
    private snackBar: MatSnackBar,
    @Inject(IGNORE_HTTP_ERRORS) private ignoreFns: IgnoreHttpError[]
  ) {}
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      tap({
        error: (err: any) => {
          if (err instanceof HttpErrorResponse) {
            if (err.status === 403) {
              this.router.navigate(["/error"], {
                queryParams: {
                  message: err.error.message,
                  status: err.status,
                  statusText: err.statusText
                }
              });
            } else if (this.ignoreFns.every(f => !f(request.url, err.status))) {
              this.snackBar.openFromComponent(SnackbarComponent, {
                data: {
                  status: err.status,
                  message: err.error.message
                } as SnackbarError,
                duration: 3000
              });
            }
          }
        }
      })
    );
  }
}
