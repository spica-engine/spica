import {Component} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {Observable, BehaviorSubject} from "rxjs";
import {switchMap, tap} from "rxjs/operators";
import {DashboardService} from "../../services/dashboard.service";
import {Dashboard} from "@spica-client/dashboard/interfaces";

@Component({
  selector: "app-dashboard-view",
  templateUrl: "./dashboard-view.component.html",
  styleUrls: ["./dashboard-view.component.scss"]
})
export class DashboardViewComponent {
  dashboard$: Observable<Dashboard>;

  componentData$: Observable<object>[] = [];

  refreshSubjects$: BehaviorSubject<any>[] = [];

  defaultTypes = ["line", "pie", "doughnut", "polarArea", "scatter", "bubble", "radar", "bar"];

  customTypes = ["table"];

  constructor(private activatedRoute: ActivatedRoute, private ds: DashboardService) {}

  ngOnInit() {
    this.dashboard$ = this.activatedRoute.params.pipe(
      switchMap(params =>
        this.ds.getDashboard(params.id).pipe(
          tap(dashboard => {
            if (!dashboard.components) {
              return;
            }
            
            for (const component of dashboard.components) {
              const refresh$ = new BehaviorSubject(undefined);
              this.refreshSubjects$.push(refresh$);
              this.componentData$.push(
                refresh$.pipe(switchMap(() => this.ds.executeComponent(component.url)))
              );
            }
          })
        )
      )
    );
  }

  refresh(i: number) {
    this.refreshSubjects$[i].next(undefined);
  }
}
