import {Component, OnInit, OnDestroy} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {Dashboard, getEmptyDashboard} from "@spica-client/dashboard/interfaces";
import {DashboardService} from "@spica-client/dashboard/services/dashboard.service";
import {filter, map, switchMap, take, tap, takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {ICONS} from "@spica-client/material";
import {MatDialog} from "@angular/material/dialog";
import {ExampleComponent} from "@spica-client/common/example";
import {deepCopy} from "@spica-client/core";

@Component({
  selector: "dashboard-add",
  templateUrl: "./add.component.html",
  styleUrls: ["./add.component.scss"]
})
export class AddComponent implements OnInit, OnDestroy {
  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private dashboardService: DashboardService,
    private dialog: MatDialog
  ) {}

  dashboard: Dashboard = getEmptyDashboard();
  onDestroy$: Subject<any> = new Subject();

  types = ["line", "pie", "doughnut", "polarArea", "scatter", "bubble", "radar", "bar", "table","card"];

  readonly icons: Array<string> = ICONS;
  readonly iconPageSize = 21;

  visibleIcons: Array<any> = this.icons.slice(0, this.iconPageSize);

  ngOnInit() {
    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        map(params => params.id),
        switchMap(id =>
          this.dashboardService.findOne(id).pipe(
            tap(dashboard => {
              if (dashboard) {
                this.dashboard = deepCopy(dashboard);
              }
            })
          )
        ),
        takeUntil(this.onDestroy$)
      )
      .subscribe();
  }

  showExample(type: string) {
    const example = this.dashboardService.getExample(type);
    this.dialog.open(ExampleComponent, {
      width: "50%",
      data: {
        code: example
      }
    });
  }

  ngOnDestroy() {
    this.onDestroy$.next();
  }

  save() {
    const upsert = this.dashboard._id
      ? this.dashboardService.update(this.dashboard)
      : this.dashboardService.insert(this.dashboard);

    upsert.toPromise().then(() => this.router.navigate(["dashboards"]));
  }

  addComponent() {
    this.dashboard.components.push({name: undefined, url: undefined, type: undefined});
  }
}
