import {Component, OnInit, OnDestroy} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {Observable, forkJoin, Subject} from "rxjs";
import {switchMap, tap, map, filter, take, flatMap, takeUntil} from "rxjs/operators";
import {Function, Log} from "../../../function/interface";
import {FunctionService} from "../../function.service";

@Component({
  selector: "log-view",
  templateUrl: "./log-view.component.html",
  styleUrls: ["./log-view.component.scss"]
})
export class LogViewComponent implements OnInit, OnDestroy {
  onDestroy = new Subject();

  isPending = false;

  functions$: Observable<Function[]>;

  maxDate = new Date();

  queryParams: Observable<any>;

  logs$: Observable<Log[]>;

  bufferSize = 500;

  constructor(private route: ActivatedRoute, private fs: FunctionService, public router: Router) {}

  ngOnInit() {
    this.queryParams = this.route.queryParams.pipe(
      map(filter => {
        filter = {...filter};
        if (filter.showErrors) {
          filter.showErrors = JSON.parse(filter.showErrors);
        }
        if (!Array.isArray(filter.function)) {
          if (!filter.function) {
            filter.function = [];
          } else {
            filter.function = [filter.function];
          }
        }

        if (filter.begin) {
          filter.begin = new Date(filter.begin);
        }
        if (filter.end) {
          filter.end = new Date(filter.end);
        }
        return filter;
      })
    );

    this.functions$ = this.fs.getFunctions();

    this.logs$ = this.queryParams.pipe(
      takeUntil(this.onDestroy),
      tap(() => (this.isPending = true)),

      switchMap(filter =>
        this.fs.getLogs(filter as any).pipe(
          map(logs => logs.filter(log => !!log)),
          map(logs => (filter.showErrors ? logs : logs.filter(log => log.channel != "stderr")))
        )
      ),
      switchMap(logs => this.functions$.pipe(map(fns => this.mapLogs(logs, fns)))),
      tap(logs => {
        this.isPending = false;
      })
    );
  }

  mapLogs(logs: Log[], fns: Function[]): Log[] {
    return logs.map(log => {
      log.function = fns.find(fn => fn._id == log.function)
        ? fns.find(fn => fn._id == log.function).name
        : log.function;
      log.created_at = this.objectIdToDate(log._id).toString();
      return log;
    });
  }

  objectIdToDate(id: string) {
    return new Date(parseInt(id.substring(0, 8), 16) * 1000);
  }

  clearLogs() {
    this.queryParams
      .pipe(
        filter(filter => filter.function),
        flatMap(filter => forkJoin(filter.function.map(fn => this.fs.clearLogs(fn)))),
        take(1)
      )
      .toPromise();
  }

  next(filter: any) {
    this.router.navigate([], {queryParams: filter, queryParamsHandling: "merge"});
  }

  formatHours(range: {begin: Date; end: Date}) {
    if (range.begin instanceof Date && range.end instanceof Date)
      return {
        begin: new Date(range.begin.setHours(0, 0, 0, 0)),
        end: new Date(range.end.setHours(23, 59, 59, 999))
      };
  }

  onExpand(height: number) {
    if (this.bufferSize < height) {
      this.bufferSize = height + 200;
    }
  }

  ngOnDestroy() {
    this.onDestroy.next();
  }
}
