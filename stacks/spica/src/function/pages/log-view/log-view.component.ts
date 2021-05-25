import {CdkVirtualScrollViewport} from "@angular/cdk/scrolling";
import {Component, OnInit, Input, ViewChild, AfterViewInit, OnDestroy} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {
  Observable,
  forkJoin,
  BehaviorSubject,
  combineLatest,
  zip,
  iif,
  Subject,
  merge,
  of
} from "rxjs";
import {switchMap, tap, map, flatMap, takeUntil} from "rxjs/operators";
import {Function, Log} from "../../../function/interface";
import {FunctionService} from "../../services/function.service";

@Component({
  selector: "log-view",
  templateUrl: "./log-view.component.html",
  styleUrls: ["./log-view.component.scss"]
})
export class LogViewComponent implements OnInit, OnDestroy {
  isPending = false;

  functions$: Observable<Function[]>;

  maxDate = new Date();

  queryParams: Observable<any>;

  logs: Set<Log> = new Set();

  logs$: Observable<Log[]>;

  logPerReq = 40;

  itemSize = 26;

  skip = 0;

  refresh = new BehaviorSubject(undefined);

  pageIndex = 0;

  bufferSize = 750;

  @Input() functionId$: BehaviorSubject<string> = new BehaviorSubject(undefined);

  @ViewChild(CdkVirtualScrollViewport)
  viewport: CdkVirtualScrollViewport;

  dispose = new Subject();

  constructor(private route: ActivatedRoute, private fs: FunctionService, public router: Router) {}

  resetScroll() {
    this.pageIndex = 0;
    this.skip = 0;
    this.logs.clear();
  }

  onScroll(itemIndex: number) {
    const displayableItemLength = this.viewport.getViewportSize() / this.itemSize;

    if (itemIndex >= (this.pageIndex + 1) * this.logPerReq - displayableItemLength) {
      this.pageIndex++;
      this.skip = this.pageIndex * this.logPerReq;
      this.refresh.next(undefined);
    }
  }

  ngOnInit() {
    this.queryParams = combineLatest(this.functionId$, this.route.queryParams).pipe(
      takeUntil(this.dispose),
      map(([functionId, filter]) => {
        filter = {...filter};

        if (filter.showErrors) {
          filter.showErrors = JSON.parse(filter.showErrors);
        }

        if (filter.realtime) {
          filter.realtime = JSON.parse(filter.realtime);
        }

        if (!Array.isArray(filter.function)) {
          if (!filter.function) {
            filter.function = [functionId].filter(Boolean);
          } else {
            filter.function = [filter.function];
          }
        }

        if (filter.realtime) {
          filter.begin = new Date();
          filter.end = undefined;

          return filter;
        }

        filter.begin = new Date(filter.begin ? filter.begin : new Date().setHours(0, 0, 0, 0));
        filter.end = new Date(filter.end ? filter.end : new Date().setHours(23, 59, 59, 999));

        return filter;
      })
    );

    this.functions$ = this.fs.getFunctions();

    this.logs$ = combineLatest(this.queryParams, this.refresh).pipe(
      takeUntil(this.dispose),
      tap(() => (this.isPending = true)),
      switchMap(([filter]) =>
        this.fs
          .getLogs({
            ...filter,
            ...(!filter.realtime ? {limit: this.logPerReq, skip: this.skip} : {})
          })
          .pipe(
            map(logs => {
              return {
                logs:
                  !filter.showErrors && filter.realtime
                    ? logs.filter(log => log.channel != "stderr")
                    : logs,
                filter
              };
            })
          )
      ),
      switchMap(({logs, filter}) =>
        this.functions$.pipe(
          map(fns => {
            return {
              logs: this.mapLogs(logs, fns),
              filter
            };
          })
        )
      ),
      switchMap(({logs, filter}) => {
        if (filter.realtime) {
          return of(logs);
        }

        logs.forEach(l => this.logs.add(l));

        return of(Array.from(this.logs));
      }),
      tap(() => (this.isPending = false))
    );
  }

  ngOnDestroy() {
    this.dispose.next();
  }

  mapLogs(logs: Log[], fns: Function[]): Log[] {
    return logs.map(log => {
      const fn = fns.find(fn => fn._id == log.function || fn.name == log.function);
      log.function = fn ? fn : log.function;
      log.created_at = this.objectIdToDate(log._id).toString();
      return log;
    });
  }

  objectIdToDate(id: string) {
    return new Date(parseInt(id.substring(0, 8), 16) * 1000);
  }

  clearLogs() {
    zip(this.queryParams, this.fs.getFunctions().pipe(map(fns => fns.map(fn => fn._id))))
      .pipe(
        tap(() => (this.isPending = true)),
        flatMap(([filter, allIds]) => {
          const deletedFunctionIds: string[] =
            filter.function && filter.function.length ? filter.function : allIds;
          return forkJoin(deletedFunctionIds.map(id => this.fs.clearLogs(id))).pipe(
            tap(() => {
              if (!filter.realtime) {
                this.resetScroll();
                this.refresh.next(undefined);
              }
            })
          );
        }),
        tap(() => (this.isPending = false))
      )
      .toPromise();
  }

  next(filter: any) {
    this.resetScroll();
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
      this.bufferSize = height + 300;
    }
  }
}
