import {animate, state, style, transition, trigger} from "@angular/animations";
import {Component, OnInit, ViewChild} from "@angular/core";
import {MatSort} from "@angular/material/sort";
import {ActivatedRoute} from "@angular/router";
import {merge, Observable, of, Subject} from "rxjs";
import {map, switchMap, tap} from "rxjs/operators";
import {FunctionService} from "../../function.service";
import {Function} from "../../interface";

@Component({
  selector: "log-view",
  templateUrl: "./log-view.component.html",
  styleUrls: ["./log-view.component.scss"],
  animations: [
    trigger("detailExpand", [
      state("collapsed", style({height: "0px", minHeight: "0", display: "none"})),
      state("expanded", style({height: "*"})),
      transition("expanded <=> collapsed", animate("225ms cubic-bezier(0.4, 0.0, 0.2, 1)"))
    ])
  ]
})
export class LogViewComponent implements OnInit {
  @ViewChild(MatSort, {static: true}) sort: MatSort;
  @ViewChild("toolbar", {static: true}) toolbar;

  public expandedElement: null;

  public dateRange: {begin: string; end: string};
  public refresh: Subject<void> = new Subject<void>();

  public displayedColumns: string[] = ["execution", "level", "timestamp", "message"];
  public dataSource: Observable<object>;

  public maxDate = new Date();
  public minDate = new Date(
    this.maxDate.getFullYear(),
    this.maxDate.getMonth(),
    this.maxDate.getDate() - 10
  );

  public function: Observable<Function>;

  public logLevelMapping = {
    log: {icon: "bug_report", color: "#6b6b6b"},
    error: {icon: "error", color: "red"},
    warn: {icon: "warning", color: "orange"},
    debug: {icon: "bug_report", color: "#6b6b6b"},
    info: {icon: "flag", color: "#0079f7"}
  };

  constructor(private route: ActivatedRoute, private fs: FunctionService) {}

  ngOnInit() {
    this.dataSource = merge(of(null), this.refresh, this.sort.sortChange).pipe(
      switchMap(() => this.route.params),
      tap(params => (this.function = this.fs.getFunction(params.id))),
      switchMap(params => this.fs.getLogs(params.id, this.dateRange)),
      map(logs => {
        return !this.sort.active
          ? logs
          : logs.sort((a, b) => {
              const isAsc = this.sort.direction === "asc";
              switch (this.sort.active) {
                case "l-abel":
                  return isAsc
                    ? String(a.label).localeCompare(String(b.label))
                    : String(b.label).localeCompare(String(a.label));
                case "timestamp":
                  return isAsc
                    ? String(a.timestamp).localeCompare(String(b.timestamp))
                    : String(b.timestamp).localeCompare(String(a.timestamp));
                default:
                  return 0;
              }
            });
      })
    );
  }

  clearLogs() {
    this.function
      .pipe(
        switchMap(fn => this.fs.clearLogs(fn._id)),
        tap(() => this.refresh.next())
      )
      .toPromise();
  }
}
