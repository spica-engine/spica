import {CdkVirtualScrollViewport} from "@angular/cdk/scrolling";
import {Component, OnInit, Input, ViewChild, OnDestroy} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {Observable, forkJoin, BehaviorSubject, combineLatest, zip, Subject, of} from "rxjs";
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

  cachedLogs: Set<Log> = new Set();

  logs$: Observable<Log[]>;

  readonly logPerReq = 40;

  readonly itemSize = 25;

  skip = 0;

  refresh = new BehaviorSubject(undefined);

  pageIndex = 0;

  bufferSize = 750;

  readonly filtersHeight = 80;

  @Input() functionId$: BehaviorSubject<string> = new BehaviorSubject(undefined);
  @Input() height$: Subject<number>;

  @ViewChild(CdkVirtualScrollViewport)
  viewport: CdkVirtualScrollViewport;

  // to use ngif with template var
  @ViewChild("realtimeToggle") realtimeToggle: any;

  @Input() realtimeConnectionTime: Date;

  dispose = new Subject();

  realtimeConnectivity: boolean;

  constructor(private route: ActivatedRoute, private fs: FunctionService, public router: Router) {
    this.fs.checkRealtimeLogConnectivity().subscribe(r => (this.realtimeConnectivity = r));
    this.realtimeConnectionTime = this.realtimeConnectionTime || new Date();
  }

  resetScroll() {
    this.pageIndex = 0;
    this.skip = 0;
    this.cachedLogs.clear();
  }

  onScroll(itemIndex: number) {
    const viewportHeight = document
      .getElementsByClassName("log-viewport")[0]
      .getBoundingClientRect().height;

    const displayableItemLength = viewportHeight / this.itemSize;
    const threshold = (this.pageIndex + 1) * this.logPerReq - displayableItemLength;

    if (itemIndex >= threshold) {
      this.pageIndex++;
      this.skip = this.pageIndex * this.logPerReq;
      this.refresh.next(undefined);
    }
  }

  ngOnInit() {
    if (this.height$) {
      this.height$.pipe(takeUntil(this.dispose)).subscribe(height => {
        const el = document.getElementsByClassName("log-viewport")[0];
        const desiredHeight = height - this.filtersHeight;
        if (el) {
          el.setAttribute("style", `height: ${desiredHeight}px`);
        }
      });
    }

    this.queryParams = combineLatest(this.functionId$, this.route.queryParams).pipe(
      takeUntil(this.dispose),
      map(([functionId, filter]) => {
        filter = {...filter};

        this.resetScroll();

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
          filter.begin = this.realtimeConnectionTime;
          filter.end = undefined;

          return filter;
        }

        filter.begin = new Date(filter.begin ? filter.begin : new Date().setHours(0, 0, 0, 0));
        filter.end = new Date(filter.end ? filter.end : new Date().setHours(23, 59, 59, 999));

        return filter;
      })
    );

    this.functions$ = this.fs.getFunctions();

    this.logs$ = combineLatest([this.queryParams, this.refresh]).pipe(
      takeUntil(this.dispose),
      tap(() => (this.isPending = true)),
      switchMap(([_filter]) =>
        this.fs
          .getLogs({
            ..._filter,
            ...(!_filter.realtime ? {limit: this.logPerReq, skip: this.skip} : {})
          })
          .pipe(
            // realtime sends undefined logs if functions create logs so frequently
            map(logs => logs.filter(log => !!log)),
            map(logs => {
              return {
                logs:
                  _filter.levels && _filter.levels.length && _filter.realtime
                    ? logs.filter(log => _filter.levels.includes(log.level.toString()))
                    : logs,
                filter: _filter
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

        logs.forEach(l => this.cachedLogs.add(l));

        return of(Array.from(this.cachedLogs));
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
