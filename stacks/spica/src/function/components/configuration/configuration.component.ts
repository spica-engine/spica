import {HttpErrorResponse} from "@angular/common/http";
import {Component, Inject, Input} from "@angular/core";
import {MatDialogRef, MAT_DIALOG_DATA} from "@angular/material/dialog";
import {Router} from "@angular/router";
import {
  denormalizeFunction,
  emptyFunction,
  FunctionOptions,
  FUNCTION_OPTIONS,
  NormalizedFunction,
  normalizeFunction
} from "@spica-client/function/interface";
import {FunctionService} from "@spica-client/function/services";
import {SavingState} from "@spica-client/material";
import {merge, Observable, of, throwError} from "rxjs";
import {catchError, endWith, flatMap, ignoreElements, share, switchMap, tap} from "rxjs/operators";

@Component({
  selector: "configuration",
  templateUrl: "./configuration.component.html",
  styleUrls: ["./configuration.component.scss"]
})
export class ConfigurationComponent {
  information: Observable<any>;
  $save: Observable<SavingState>;
  index: string;

  apiUrl;
  function: NormalizedFunction = emptyFunction();
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialogRef: MatDialogRef<ConfigurationComponent>,
    @Inject(FUNCTION_OPTIONS) options: FunctionOptions,
    private functionService: FunctionService,
    private router: Router
  ) {
    if (this.data && this.data.function) this.function = normalizeFunction(this.data.function);
    this.apiUrl = options.url;
    this.information = this.functionService.information().pipe(
      tap(
        information => (this.function.timeout = this.function.timeout || information.timeout * 0.1)
      ),
      share()
    );
    if (!this.function._id) {
      this.function.triggers = [
        {
          type: undefined,
          active: true,
          handler: "default",
          options: {}
        }
      ];
      this.function.language = "javascript";
    }
  }

  formatTimeout(value: number) {
    if (value >= 60) {
      return (Math.round((value / 60) * 100 + Number.EPSILON) / 100).toFixed(1) + "m";
    }
    return `${value}s`;
  }
  save() {
    const fn = denormalizeFunction(this.function);
    const isInsert = !this.function._id;

    const save = isInsert
      ? this.functionService.insertOne(fn)
      : this.functionService.replaceOne(fn);

    const code = this.functionService.getExample(this.function.triggers[0]);
    this.index = code;

    this.$save = merge(
      of(SavingState.Saving),
      save.pipe(
        flatMap(fn =>
          this.function._id
            ? of(fn)
            : this.functionService.updateIndex(fn._id, this.index).pipe(
                tap(() => this.router.navigate(["function", fn._id])),
                catchError(error => {
                  if (error.status == 422) {
                    return of(error);
                  }
                  return throwError(error);
                }),
                ignoreElements()
              )
        ),
        ignoreElements(),
        endWith(SavingState.Saved),
        catchError(() => of(SavingState.Failed)),
        tap(() => this.dialogRef.close())
      )
    );
  }
}
