import {Component, OnInit, Input} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {Observable, forkJoin, BehaviorSubject, combineLatest, zip} from "rxjs";
import {switchMap, tap, map, flatMap} from "rxjs/operators";
import {Function, Log} from "../../../function/interface";
import {FunctionService} from "../../function.service";

@Component({
  selector: "log-view",
  templateUrl: "./log-view.component.html",
  styleUrls: ["./log-view.component.scss"]
})
export class LogViewComponent implements OnInit {
  isPending = false;

  functions$: Observable<Function[]>;

  maxDate = new Date();

  queryParams: Observable<any>;

  logs$: Observable<Log[]>;

  bufferSize = 500;

  @Input() functionId$: BehaviorSubject<string> = new BehaviorSubject(undefined);

  constructor(private route: ActivatedRoute, private fs: FunctionService, public router: Router) {}

  ngOnInit() {
    this.queryParams = combineLatest(this.functionId$, this.route.queryParams).pipe(
      map(([functionId, filter]) => {
        filter = {...filter};
        if (filter.showErrors) {
          filter.showErrors = JSON.parse(filter.showErrors);
        }
        if (!Array.isArray(filter.function)) {
          if (!filter.function) {
            filter.function = [functionId].filter(Boolean);
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
      tap(() => (this.isPending = true)),
      switchMap(filter =>
        this.fs.getLogs(filter as any).pipe(
          map(logs => logs.filter(log => !!log)),
          map(logs => (filter.showErrors ? logs : logs.filter(log => log.channel != "stderr")))
        )
      ),
      switchMap(logs => this.functions$.pipe(map(fns => this.mapLogs(logs, fns)))),
      tap(() => (this.isPending = false))
    );
  }

  mapLogs(logs: Log[], fns: Function[]): Log[] {
    return logs.map(log => {
      const fn = fns.find(fn => fn._id == log.function);
      log.function = fn ? fn : log.function;
      log.created_at = this.objectIdToDate(log._id).toString();
      return log;
    });
  }

  objectIdToDate(id: string) {
    return new Date(parseInt(id.substring(0, 8), 16) * 1000);
  }

  clearLogs() {
    zip(
      this.queryParams.pipe(map(filter => filter.function)),
      this.fs.getFunctions().pipe(map(fns => fns.map(fn => fn._id)))
    )
      .pipe(
        tap(() => (this.isPending = true)),
        flatMap(([filterIds, allIds]) => {
          const deletedFunctionIds: string[] = filterIds && filterIds.length ? filterIds : allIds;
          return forkJoin(deletedFunctionIds.map(id => this.fs.clearLogs(id)));
        }),
        tap(() => (this.isPending = false))
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
}
