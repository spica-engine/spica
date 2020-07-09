import {animate, state, style, transition, trigger} from "@angular/animations";
import {Component, OnInit} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {Observable, forkJoin} from "rxjs";
import {switchMap, tap, map, filter, take, flatMap} from "rxjs/operators";
import {Function, Log} from "../../../function/interface";
import {FunctionService} from "../../function.service";

@Component({
  selector: "log-view",
  templateUrl: "./log-view.component.html",
  styleUrls: ["./log-view.component.scss"],
  animations: [
    trigger("detail", [
      state("collapsed", style({height: "0px", padding: "0px", minHeight: "0px"})),
      state("expanded", style({height: "*", paddingTop: "10px", paddingBottom: "10px"})),
      transition("expanded <=> collapsed", animate("225ms cubic-bezier(0.4, 0.0, 0.2, 1)"))
    ])
  ]
})
export class LogViewComponent implements OnInit {
  displayedColumns: string[] = ["timestamp", "content"];

  expandedLog: Log;

  logs$: Observable<Log[]>;

  functions$: Observable<Function[]>;

  maxDate = new Date();
  selectedFunctions: string[];

  queryParams: Observable<any>;

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
      tap(filter => {
        const functionColumnIndex = this.displayedColumns.indexOf("function");
        if (filter.function.length > 1 && functionColumnIndex == -1) {
          this.displayedColumns.splice(1, 0, "function");
        } else if (filter.function.length <= 1 && functionColumnIndex != -1) {
          this.displayedColumns.splice(functionColumnIndex, 1);
        }
      }),
      switchMap(filter =>
        this.fs
          .getLogs(filter)
          .pipe(
            map(logs => (filter.showErrors ? logs : logs.filter(log => log.channel != "stderr")))
          )
      ),
      switchMap(logs => {
        return this.fs.getFunctions().pipe(
          map(fns => {
            logs.map(log => {
              log.function = fns.find(fn => fn._id == log.function)
                ? fns.find(fn => fn._id == log.function).name
                : log.function;
              log.created_at = this.objectIdToDate(log._id).toString();
              return log;
            });
            return logs;
          })
        );
      })
    );
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
}
