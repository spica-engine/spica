import {HttpClient} from "@angular/common/http";
import {Component, EventEmitter, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {Scheme, SchemeObserver} from "@spica-server/core";
import {Observable, Subscription} from "rxjs";
import {delay, filter, map, switchMap, takeUntil, tap} from "rxjs/operators";
import {LanguageService} from "../../components/editor/language.service";
import {FunctionService} from "../../function.service";
import {emptyFunction, Enqueuer, Function, Information, Trigger} from "../../interface";

@Component({
  selector: "functions-add",
  templateUrl: "./add.component.html",
  styleUrls: ["./add.component.scss"]
})
export class AddComponent implements OnInit, OnDestroy {
  @ViewChild("toolbar", {static: true}) toolbar;

  function: Function = emptyFunction();

  information: Observable<Information>;

  dependencies: Observable<any>;
  dependencyInstallPending = false;

  private mediaMatchObserver: Subscription;

  editorOptions = {theme: "vs-light", language: "typescript", minimap: {enabled: false}};
  index: string;
  lastSaved: Date;
  isSaving: boolean = false;

  private dispose = new EventEmitter();

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
        switchMap(params => this.functionService.getFunction(params.id)),
        tap(fn => {
          this.function = {
            ...fn,
            env: Object.entries(fn.env as any).map(([name, value]) => ({name, value})) as any
          };
          this.ls.request("open", this.function._id);
          this.dependencies = this.http.get(`api:/function/${fn._id}/dependencies`);
        }),
        switchMap(fn => this.functionService.getIndex(fn._id)),
        takeUntil(this.dispose)
      )
      .subscribe(response => (this.index = response.index));
  }

  // run(handler: string) {
  //   this.$run = this.http
  //     .request(
  //       new HttpRequest("GET", `api:/function/${this.function._id}/run/${handler}`, {
  //         reportProgress: true,
  //         responseType: "text"
  //       })
  //     )
  //     .pipe(
  //       scan((accumulator: any, event: HttpEvent<any>) => {
  //         if (event.type == HttpEventType.Sent) {
  //           accumulator.state = "running";
  //         } else if (event.type == HttpEventType.DownloadProgress) {
  //           accumulator.logs = String(event["partialText"] || "")
  //             .split("\n")
  //             .filter(line => !!line)
  //             .map(line => JSON.parse(line));
  //         } else if (event.type == HttpEventType.Response) {
  //           accumulator.state = accumulator.logs.pop().state || "failed";
  //         }
  //         return accumulator;
  //       }, {})
  //     );
  // }

  addVariable() {
    this.function.env.push({value: undefined, name: undefined});
  }

  removeVariable(index) {
    this.function.env.splice(index, 1);
  }

  updateIndex() {
    if (this.function._id) {
      this.isSaving = true;
      this.functionService
        .updateIndex(this.function._id, this.index)
        .pipe(delay(300))
        .toPromise()
        .then(() => {
          this.lastSaved = new Date();
          this.isSaving = false;
        });
    }
  }

  clearEmptyEnvVars() {
    this.function.env = this.function.env.filter(variable => variable.name && variable.value);
  }

  save() {
    this.clearEmptyEnvVars();
    this.functionService
      .upsertOne({
        ...this.function,
        env: this.function.env.reduce((acc, env) => {
          acc[env.name] = env.value;
          return acc;
        }, {}) as any
      })
      .pipe(switchMap(fn => this.functionService.updateIndex(fn._id, this.index)))
      .toPromise()
      .then(() => this.router.navigate(["function"]));
  }

  addDependency(name: string) {
    this.dependencyInstallPending = true;
    this.http
      .post(`api:/function/${this.function._id}/dependencies`, {name})
      .toPromise()
      .then(() => {
        this.dependencies = this.http.get(`api:/function/${this.function._id}/dependencies`);
        this.dependencyInstallPending = false;
      })
      .catch(() => {
        this.dependencyInstallPending = false;
      });
  }

  changeScheme(isDark: boolean) {
    this.editorOptions = {...this.editorOptions, theme: isDark ? "vs-dark" : "vs-light"};
  }
  ngOnDestroy() {
    this.dispose.emit();
    this.ls.close();
    this.mediaMatchObserver.unsubscribe();
  }
  deleteDependency(name: string) {
    this.dependencyInstallPending = true;
    this.http
      .post(`api:/function/${this.function._id}/delete-dependency`, {name})
      .toPromise()
      .then(() => {
        this.dependencies = this.http.get(`api:/function/${this.function._id}/dependencies`);
        this.dependencyInstallPending = false;
      })
      .catch(() => {
        this.dependencyInstallPending = false;
      });
  }
}
