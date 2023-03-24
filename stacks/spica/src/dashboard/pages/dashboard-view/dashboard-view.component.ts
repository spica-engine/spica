import {ActivatedRoute} from "@angular/router";
import {Observable, BehaviorSubject} from "rxjs";
import {switchMap, tap} from "rxjs/operators";
import {DashboardService} from "../../services/dashboard.service";
import {Dashboard} from "@spica-client/dashboard/interfaces";
import {Component, OnInit} from "@angular/core";
import {BreakpointObserver, BreakpointState} from "@angular/cdk/layout";

@Component({
  selector: "app-dashboard-view",
  templateUrl: "./dashboard-view.component.html",
  styleUrls: ["./dashboard-view.component.scss"]
})
export class DashboardViewComponent implements OnInit {
  dashboard$: Observable<Dashboard>;

  componentData$: Observable<object>[] = [];

  refreshSubjects$: BehaviorSubject<any>[] = [];

  customizeDisabled = false;

  arePendings: boolean[] = [];

  constructor(
    private activatedRoute: ActivatedRoute,
    private ds: DashboardService,
    public breakpointObserver: BreakpointObserver
  ) {
    this.breakpointObserver
      .observe("(max-width: 1280px)")
      .subscribe((state: BreakpointState) => (this.customizeDisabled = state.matches));
  }

  ngOnInit() {
    this.dashboard$ = this.activatedRoute.params.pipe(
      switchMap(params =>
        this.ds.findOne(params.id).pipe(
          tap(dashboard => {
            if (!dashboard || !dashboard.components) {
              return;
            }

            this.clearCards();

            for (const [index, component] of dashboard.components.entries()) {
              const refresh$ = new BehaviorSubject(undefined);
              this.refreshSubjects$.push(refresh$);

              this.arePendings.push(true);

              this.componentData$.push(
                refresh$.pipe(
                  tap(() => (this.arePendings[index] = true)),
                  switchMap(filter => this.ds.executeComponent(component.url, filter)),
                  tap(() => (this.arePendings[index] = false))
                )
              );
            }
          })
        )
      )
    );
  }

  clearCards() {
    this.refreshSubjects$ = [];
    this.componentData$ = [];
    this.arePendings = [];
  }

  onUpdate(filters: any[] = [], i: number) {
    const queryFilter = {};

    for (const filter of filters) {
      queryFilter[filter.key] = filter.value;
    }

    this.refreshSubjects$[i].next(queryFilter);
  }

}