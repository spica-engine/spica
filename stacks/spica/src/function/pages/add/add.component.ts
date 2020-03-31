import {HttpClient, HttpErrorResponse} from "@angular/common/http";
import {Component, EventEmitter, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {Scheme, SchemeObserver} from "@spica-client/core";
import {SavingState} from "@spica-client/material";
import {merge, Observable, of, Subject, Subscription, throwError} from "rxjs";
import {
  catchError,
  delay,
  endWith,
  filter,
  flatMap,
  ignoreElements,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap
} from "rxjs/operators";
import {LanguageService} from "../../components/editor/language.service";
import {FunctionService} from "../../function.service";
import {
  denormalizeFunction,
  emptyFunction,
  emptyTrigger,
  Information,
  NormalizedFunction,
  normalizeFunction
} from "../../interface";

@Component({
  selector: "functions-add",
  templateUrl: "./add.component.html",
  styleUrls: ["./add.component.scss"]
})
export class AddComponent implements OnInit, OnDestroy {
  @ViewChild("toolbar", {static: true}) toolbar;

  function: NormalizedFunction = emptyFunction();

  information: Observable<Information>;

  dependencies: Observable<any>;
  dependencyInstallPending = false;

  isHandlerDuplicated = false;
  serverError: string;

  private mediaMatchObserver: Subscription;
  private dispose = new EventEmitter();
  editorOptions = {theme: "vs-light", language: "typescript", minimap: {enabled: false}};

  index: string;
  $indexSave: Observable<Date | "inprogress">;

  $save: Observable<SavingState>;

  $markers = new Subject<monaco.editor.IMarkerData[]>();

  $run: Observable<{state: "failed" | "running" | "succeeded"; logs: any[]}>;

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private functionService: FunctionService,
    private http: HttpClient,
    private ls: LanguageService,
    schemeObserver: SchemeObserver
  ) {
    this.mediaMatchObserver = schemeObserver
      .observe(Scheme.Dark)
      .pipe(takeUntil(this.dispose))
      .subscribe(r => this.changeScheme(r));

    this.information = this.functionService.information();
  }

  ngOnInit() {
    this.ls.open();
    this.ls
      .fromEvent("reconnect")
      .pipe(takeUntil(this.dispose))
      .subscribe(() => this.ls.request("open", this.function._id));

    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        switchMap(params => this.functionService.getFunction(params.id).pipe(take(1))),
        tap(fn => {
          this.dependencyInstallPending = false;
          this.$save = of(SavingState.Pristine);
          this.function = normalizeFunction(fn);
          this.ls.request("open", this.function._id);
          this.getDependencies();
        }),
        switchMap(fn => this.functionService.getIndex(fn._id)),
        takeUntil(this.dispose)
      )
      .subscribe(response => (this.index = response.index));
  }

  ngOnDestroy() {
    this.dispose.emit();
    this.ls.close();
    this.mediaMatchObserver.unsubscribe();
  }

  run(handler: string) {
    // this.$run = this.http
    //   .request(
    //     new HttpRequest("GET", `api:/function/${this.function._id}/run/${handler}`, {
    //       reportProgress: true,
    //       responseType: "text"
    //     })
    //   )
    //   .pipe(
    //     scan((accumulator: any, event: HttpEvent<any>) => {
    //       if (event.type == HttpEventType.Sent) {
    //         accumulator.state = "running";
    //       } else if (event.type == HttpEventType.DownloadProgress) {
    //         accumulator.logs = String(event["partialText"] || "")
    //           .split("\n")
    //           .filter(line => !!line)
    //           .map(line => JSON.parse(line));
    //       } else if (event.type == HttpEventType.Response) {
    //         accumulator.state = accumulator.logs.pop().state || "failed";
    //       }
    //       return accumulator;
    //     }, {})
    //   );
  }

  addTrigger() {
    this.function.triggers.push(emptyTrigger());
  }

  addVariable() {
    this.function.env.push({value: undefined, name: undefined});
  }

  removeVariable(index: number) {
    this.function.env.splice(index, 1);
  }

  updateIndex() {
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
                endColumn: diagnostic.end.column,
                severity: monaco.MarkerSeverity.Error
              }))
            );
            return of(new Date());
          }
          return throwError(error);
        })
      ) as Observable<Date | "inprogress">;
    }
  }

  clearEmptyEnvVars() {
    this.function.env = this.function.env.filter(variable => variable.name && variable.value);
  }

  save() {
    this.serverError = undefined;
    this.clearEmptyEnvVars();
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

  changeScheme(isDark: boolean) {
    this.editorOptions = {...this.editorOptions, theme: isDark ? "vs-dark" : "vs-light"};
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
    this.function.triggers.forEach(trigger => {
      const duplicatedHandler = this.function.triggers.filter(
        item => item.handler == trigger.handler
      );
      if (duplicatedHandler.length > 1) {
        this.isHandlerDuplicated = true;
      }
    });
  }

  deleteTrigger(i: number) {
    this.function.triggers = this.function.triggers.filter((val, index) => index != i);
    this.checkHandlers();
  }
}
