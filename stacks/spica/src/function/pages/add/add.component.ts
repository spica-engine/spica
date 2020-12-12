import {HttpClient, HttpErrorResponse} from "@angular/common/http";
import {Component, EventEmitter, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {SavingState} from "@spica-client/material";
import {merge, Observable, of, Subject, throwError, BehaviorSubject} from "rxjs";
import {
  catchError,
  delay,
  endWith,
  filter,
  flatMap,
  ignoreElements,
  share,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap
} from "rxjs/operators";
import {FunctionService} from "../../function.service";
import {
  denormalizeFunction,
  emptyFunction,
  emptyTrigger,
  Information,
  NormalizedFunction,
  normalizeFunction,
  Trigger
} from "../../interface";
import {MatDialog} from "@angular/material/dialog";
import {CodeComponent} from "./code/code.component";

@Component({
  selector: "functions-add",
  templateUrl: "./add.component.html",
  styleUrls: ["./add.component.scss"]
})
export class AddComponent implements OnInit, OnDestroy {
  @ViewChild("toolbar", {static: true}) toolbar;

  function: NormalizedFunction = emptyFunction();

  selectedFunctionId = new BehaviorSubject(undefined);

  information: Observable<Information>;

  dependencies: Observable<any>;
  dependencyInstallPending = false;

  isHandlerDuplicated = false;
  serverError: string;

  enableLogView: boolean = false;

  private dispose = new EventEmitter();
  editorOptions = {language: "typescript", minimap: {enabled: false}};

  isIndexPending = false;

  index: string;
  $indexSave: Observable<Date | "inprogress">;

  $save: Observable<SavingState>;

  $markers = new Subject<unknown[]>();

  triggersEditMode = [];

  batchingDeadline: number = 0;

  maxBatchCount: number = 0;

  batching: boolean = false;

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private functionService: FunctionService,
    private http: HttpClient,
    public dialog: MatDialog
  ) {
    this.information = this.functionService.information().pipe(
      share(),
      tap(information => {
        this.function.timeout = this.function.timeout || information.timeout * 0.7;
      })
    );
  }

  ngOnInit() {
    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        tap(params => this.selectedFunctionId.next(params.id)),
        switchMap(params => this.functionService.getFunction(params.id).pipe(take(1))),
        tap(fn => {
          this.dependencyInstallPending = false;
          this.serverError = undefined;
          this.isIndexPending = true;
          this.$save = of(SavingState.Pristine);
          this.function = normalizeFunction(fn);
          for (const [index, trigger] of this.function.triggers.entries()) {
            this.triggersEditMode[index] = true;
            if (trigger.batch) {
              this.batching = true;
              this.maxBatchCount = Math.max(this.maxBatchCount, trigger.batch.limit);
              this.batchingDeadline = Math.max(this.batchingDeadline, trigger.batch.deadline);
            }
          }
          this.getDependencies();
        }),
        switchMap(fn => this.functionService.getIndex(fn._id)),
        takeUntil(this.dispose)
      )
      .subscribe(
        response => {
          this.isIndexPending = false;
          this.index = response.index;
        },
        () => (this.isIndexPending = false)
      );
  }

  ngOnDestroy() {
    this.dispose.emit();
  }

  formatTimeout(value: number) {
    if (value >= 60) {
      return (Math.round((value / 60) * 100 + Number.EPSILON) / 100).toFixed(1) + "m";
    }
    return `${value}s`;
  }

  addTrigger() {
    this.function.triggers.push(emptyTrigger());
    this.triggersEditMode[this.function.triggers.length - 1] = true;
  }

  deleteTrigger(i: number) {
    this.function.triggers.splice(i, 1);
    this.checkHandlers();
  }

  addVariable() {
    this.function.env.push({value: undefined, key: undefined});
  }

  removeVariable(index: number) {
    this.function.env.splice(index, 1);
  }

  showExample(trigger: Trigger) {
    let code = this.functionService.getExample(trigger);
    this.dialog.open(CodeComponent, {
      width: "80%",
      data: {
        code: code
      }
    });
  }

  updateIndex() {
    if (this.isIndexPending) return;

    if (this.function._id) {
      this.$markers.next([]);
      this.$indexSave = this.functionService.updateIndex(this.function._id, this.index).pipe(
        startWith("inprogress"),
        endWith(new Date()),
        delay(300),
        catchError(error => {
          if (error.status == 422) {
            this.$markers.next(
              error.error.map(diagnostic => ({
                message: diagnostic.text,
                code: `TS-${diagnostic.code}`,
                startLineNumber: diagnostic.start.line,
                startColumn: diagnostic.start.column,
                endLineNumber: diagnostic.end.line,
                endColumn: diagnostic.end.column
              }))
            );
            return of(new Date());
          }
          return throwError(error);
        })
      ) as Observable<Date | "inprogress">;
    }
  }

  save() {
    if (this.isIndexPending) return;

    this.serverError = undefined;

    for (const trigger of this.function.triggers) {
      if (this.batching) {
        trigger.batch = {
          deadline: this.batchingDeadline,
          limit: this.maxBatchCount
        };
      } else {
        delete trigger.batch;
      }
    }

    const fn = denormalizeFunction(this.function);

    const isInsert = !this.function._id;

    const save = isInsert
      ? this.functionService.insertOne(fn)
      : this.functionService.replaceOne(fn);

    this.$save = merge(
      of(SavingState.Saving),
      save.pipe(
        flatMap(fn =>
          this.functionService.updateIndex(fn._id, this.index).pipe(
            catchError(error => {
              if (error.status == 422) {
                return of(error);
              }
              return throwError(error);
            }),
            tap(() => isInsert && this.router.navigate([`function/${fn._id}`])),
            ignoreElements()
          )
        ),
        endWith(SavingState.Saved),
        catchError((err: HttpErrorResponse) => {
          this.serverError = err.error.message;
          return of(SavingState.Failed);
        })
      )
    );
  }

  getDependencies() {
    this.dependencies = this.http.get(`api:/function/${this.function._id}/dependencies`);
  }

  addDependency(name: string) {
    this.dependencyInstallPending = true;
    this.http
      .post(`api:/function/${this.function._id}/dependencies`, {name})
      .toPromise()
      .then(() => {
        this.getDependencies();
        this.dependencyInstallPending = false;
      })
      .catch(() => {
        this.dependencyInstallPending = false;
      });
  }

  deleteDependency(name: string) {
    this.dependencyInstallPending = true;
    this.http
      .delete(`api:/function/${this.function._id}/dependencies/${name}`)
      .toPromise()
      .then(() => {
        this.dependencies = this.http.get(`api:/function/${this.function._id}/dependencies`);
        this.dependencyInstallPending = false;
      })
      .catch(() => {
        this.dependencyInstallPending = false;
      });
  }

  checkHandlers() {
    this.isHandlerDuplicated = false;
    for (const trigger of this.function.triggers) {
      if (this.function.triggers.filter(item => item.handler == trigger.handler).length > 1) {
        this.isHandlerDuplicated = true;
        break;
      }
    }
  }
}
