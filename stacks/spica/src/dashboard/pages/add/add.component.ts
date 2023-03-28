import {Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {Dashboard, getEmptyComponent, getEmptyDashboard, Ratio} from "@spica-client/dashboard/interfaces";
import {DashboardService} from "@spica-client/dashboard/services/dashboard.service";
import {switchMap, tap} from "rxjs/operators";
import {of, Subject} from "rxjs";
import {ICONS} from "@spica-client/material";
import {MatDialog} from "@angular/material/dialog";
import {ExampleComponent} from "@spica-client/common/example";
import {deepCopy} from "@spica-client/core";
import {Observable, BehaviorSubject} from "rxjs";

@Component({
  selector: "dashboard-add",
  templateUrl: "./add.component.html",
  styleUrls: ["./add.component.scss"]
})
export class AddComponent implements OnInit, OnDestroy {
  dashboard: Dashboard = getEmptyDashboard();

  onDestroy$: Subject<any> = new Subject();

  componentData$: Observable<object>[] = [];

  refreshSubjects$: BehaviorSubject<any>[] = [];

  defaultTypes = ["line", "pie", "doughnut", "polarArea", "scatter", "bubble", "radar", "bar"];

  customTypes = ["table", "card", "statistic"];

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private dashboardService: DashboardService,
    private dialog: MatDialog
  ) {}

  types = this.defaultTypes.concat(...this.customTypes);

  ratios = ["1/1", "1/2", "2/1", "2/2", "4/2", "4/4"];

  readonly icons: Array<string> = ICONS;
  readonly iconPageSize = 21;

  visibleIcons: Array<any> = this.icons.slice(0, this.iconPageSize);

  ngOnInit() {
    this.activatedRoute.params
      .pipe(
        switchMap(params =>
          this.dashboardService.findOne(params.id).pipe(
            tap(dashboard => {
              if (!dashboard || !dashboard.components) {
                return;
              }

              dashboard.components = dashboard.components.map((element)=>{
                // remove this before make the PR ready
                element.ratio = Ratio.TwoByTwo
                return element;
              })

              this.dashboard = deepCopy(dashboard);

              this.clearCards();

              for (let component of this.dashboard.components) {
                const data = JSON.parse(this.dashboardService.getExample(component.type));
                this.componentData$.push(of(data));
              }
            })
          )
        )
      )
      .toPromise();
  }

  clearCards() {
    this.refreshSubjects$ = [];
    this.componentData$ = [];
  }

  getMockData(type: string, index: number) {
    let data = JSON.parse(this.dashboardService.getExample(type));

    if (index >= 0 && index < this.componentData$.length) {
      this.componentData$[index] = of(data);
    } else {
      this.componentData$.push(of(data));
    }
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
    this.dashboard.components.push(getEmptyComponent());

    this.updateRef();
  }

  removeComponent(i: number) {
    this.dashboard.components.splice(i, 1);
    this.componentData$.splice(i, 1);

    this.updateRef();
  }

  updateRef() {
    this.dashboard = {
      ...this.dashboard
    };
  }
}
