import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  ViewChild,
  Renderer2,
  ChangeDetectorRef,
  RendererStyleFlags2
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { SavingState } from "@spica-client/material";
import { merge, Observable, of, Subject, throwError, BehaviorSubject } from "rxjs";
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
import { FunctionService } from "../../function.service";
import {
  denormalizeFunction,
  emptyFunction,
  emptyTrigger,
  Information,
  NormalizedFunction,
  normalizeFunction,
  Trigger
} from "../../interface";
import { MatDialog } from "@angular/material/dialog";
import { ExampleComponent } from "@spica-client/common/example";

@Component({
  selector: "functions-add",
  templateUrl: "./add.component.html",
  styleUrls: ["./add.component.scss"]
})
export class AddComponent implements OnInit, OnDestroy {
  @ViewChild("toolbar", { static: true }) toolbar;

  function: NormalizedFunction = emptyFunction();

  selectedFunctionId = new BehaviorSubject(undefined);

  information: Observable<Information>;

  dependencies: Observable<any>;
  dependencyInstallPending = false;

  isHandlerDuplicated = false;
  serverError: string;

  enableLogView: boolean = false;

  onFullScreen: boolean = false;

  private dispose = new EventEmitter();

  editorOptions = {
    language: "javascript",
    minimap: { enabled: false },
    automaticLayout: true,
    scrollbar: { alwaysConsumeMouseWheel: false }
  };

  isIndexPending = false;

  index: string;
  $indexSave: Observable<Date | "inprogress">;

  $save: Observable<SavingState>;

  $markers = new Subject<unknown[]>();

  triggersEditMode = [];

  batchingDeadline: number = 0;

  maxBatchCount: number = 0;

  batching: boolean = false;

  browserFullscreenKeywords = {
    open: "",
    onChange: "",
    fullScreenElement: "",
    exit: ""
  };

  sections = {
    triggers: true,
    dependencies: false,
    envs: false, 
    optionals: false
  }
  editName = false;
  editDescription = false;

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private functionService: FunctionService,
    private http: HttpClient,
    public dialog: MatDialog,
    public renderer: Renderer2,
    public changeDetector: ChangeDetectorRef
  ) {
    this.information = this.functionService.information().pipe(
      share(),
      tap(information => {
        this.function.timeout = this.function.timeout || information.timeout * 0.7;
      })
    );
  }

  resetBatchOptions() {
    this.batching = false;
    this.maxBatchCount = 0;
    this.batchingDeadline = 0;
  }

  ngOnInit() {
    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        tap(params => this.selectedFunctionId.next(params.id)),
        switchMap(params => this.functionService.getFunction(params.id).pipe(take(1))),
        tap(fn => {
          this.resetBatchOptions();
          this.dependencyInstallPending = false;
          this.serverError = undefined;
          this.isIndexPending = true;
          this.$save = of(SavingState.Pristine);
          this.function = normalizeFunction(fn);
          for (const [index, trigger] of this.function.triggers.entries()) {
            this.triggersEditMode[index] = false;
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
    this.triggersEditMode.splice(i, 1);
    this.checkHandlers();
  }

  addVariable() {
    this.function.env.push({ value: undefined, key: undefined });
  }

  removeVariable(index: number) {
    this.function.env.splice(index, 1);
  }

  showExample(trigger: Trigger) {
    const code = this.functionService.getExample(trigger);
    this.dialog.open(ExampleComponent, {
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
      .post(`api:/function/${this.function._id}/dependencies`, { name })
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

  async switchToFullscreen() {
    if (!this.onFullScreen) {
      if (!this.enableLogView) {
        this.enableLogView = true;
        this.changeDetector.detectChanges();
      }

      const content = document.getElementsByClassName("mat-sidenav-content").item(0);

      try {
        this.setBrowserDefaults();

        this.applyStyles();

        await this.requestFullscreen(content);

        this.onFullScreen = true;
      } catch (e) {
        this.revertStyles();
      }
    } else {
      await document[this.browserFullscreenKeywords.exit]();

      this.revertStyles();

      this.onFullScreen = false;
    }
  }

  getFullscreenElements() {
    const codeActions = document.getElementsByClassName("code-actions").item(0);
    const codeEditor = document.getElementsByClassName("editor").item(0);
    const logs = document.getElementsByClassName("sidecar-log-view").item(0);
    const content = document.getElementsByClassName("mat-sidenav-content").item(0);

    return { codeActions, codeEditor, logs, content };
  }

  applyStyles() {
    const { codeActions, codeEditor, logs, content } = this.getFullscreenElements();

    this.renderer.addClass(codeActions, "full-screen-code-actions");
    this.renderer.addClass(codeEditor, "full-screen-code");
    this.renderer.addClass(logs, "full-screen-log");
    this.renderer.setStyle(content, "margin-left", "0px", RendererStyleFlags2.Important);
  }

  revertStyles() {
    const { codeActions, codeEditor, logs, content } = this.getFullscreenElements();

    this.renderer.removeClass(codeActions, "full-screen-code-actions");
    this.renderer.removeClass(codeEditor, "full-screen-code");
    this.renderer.removeClass(logs, "full-screen-log");
    this.renderer.removeStyle(content, "margin-left");
  }

  setBrowserDefaults() {
    if (document.exitFullscreen) {
      this.browserFullscreenKeywords = {
        open: "requestFullscreen",
        onChange: "fullscreenchange",
        fullScreenElement: "fullscreenElement",
        exit: "exitFullscreen"
      };
    } else if (document["webkitExitFullscreen"]) {
      this.browserFullscreenKeywords = {
        open: "webkitRequestFullscreen",
        onChange: "webkitfullscreenchange",
        fullScreenElement: "webkitFullscreenElement",
        exit: "webkitExitFullscreen"
      };
    } else if (document["msExitFullscreen"]) {
      this.browserFullscreenKeywords = {
        open: "msRequestFullscreen",
        onChange: "msfullscreenchange",
        fullScreenElement: "msFullscreenElement",
        exit: "msExitFullscreen"
      };
    } else if (document["mozCancelFullScreen"]) {
      this.browserFullscreenKeywords = {
        open: "mozRequestFullScreen",
        onChange: "mozfullscreenchange",
        fullScreenElement: "mozFullScreenElement",
        exit: "mozCancelFullScreen"
      };
    } else {
      throw new Error("Unable to detect browser.");
    }
  }

  async requestFullscreen(element: Element): Promise<void> {
    await element[this.browserFullscreenKeywords.open]();

    const escHandler = () => {
      if (!document[this.browserFullscreenKeywords.fullScreenElement]) {
        document[this.browserFullscreenKeywords.exit]().catch(e => console.log(e));
        this.revertStyles();
        this.onFullScreen = false;
      }
    };

    document.addEventListener(this.browserFullscreenKeywords.onChange, escHandler);
  }
}
