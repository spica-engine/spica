import {Injectable} from "@angular/core";
import {ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree} from "@angular/router";
import {select, Store} from "@ngrx/store";
import {first, map, switchMap, take} from "rxjs/operators";
import {DashboardService} from "./services/dashboard.service";
import * as fromDashboard from "./state/dashboard.reducer";
import {AddComponent} from "./pages/add/add.component";
import {MatDialog} from "@angular/material/dialog";
import {MatAwareDialogComponent} from "@spica-client/material";
import {Observable, of} from "rxjs";
import {getEmptyDashboard} from "./interfaces";
import isEqual from "lodash-es/isEqual";

@Injectable({providedIn: "root"})
export class DashboardIndexGuard {
  constructor(
    private store: Store<fromDashboard.State>,
    private ds: DashboardService,
    private router: Router
  ) {}

  canActivate() {
    return this.store.pipe(
      select(fromDashboard.selectLoaded),
      take(1),
      switchMap(loaded =>
        loaded
          ? this.store.pipe(select(fromDashboard.selectEmpty))
          : this.ds
              .retrieve()
              .pipe(switchMap(() => this.store.pipe(select(fromDashboard.selectEmpty))))
      ),
      map(empty => (empty ? this.router.createUrlTree(["dashboards", "welcome"]) : true))
    );
  }
}

@Injectable()
export class DashboardCanDeactivate {
  awareDialogData = {
    icon: "help",
    title: "Confirmation",
    templateOrDescription:
      "You have unsaved changes and they will be lost if you continue without save them.",
    answer: "",
    confirmText: "Continue without save",
    cancelText: "Cancel",
    noAnswer: true
  };

  constructor(
    private router: Router,
    private dashboardService: DashboardService,
    public matDialog: MatDialog
  ) {}

  openDialog() {
    return this.matDialog
      .open(MatAwareDialogComponent, {
        data: this.awareDialogData
      })
      .afterClosed()
      .pipe(first());
  }

  canDeactivate(
    component: AddComponent,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const state = this.router.getCurrentNavigation().extras.state;

    if (state && state.skipSaveChanges) {
      return true;
    }

    const dashboardWithChanges = component.dashboard;
    const initialDashboard = getEmptyDashboard();

    if (isEqual(dashboardWithChanges, initialDashboard)) {
      return true;
    }

    if (dashboardWithChanges._id) {
      return this.dashboardService.findOne(dashboardWithChanges._id).pipe(
        first(),
        switchMap(existingDashboard =>
          isEqual(existingDashboard, dashboardWithChanges) ? of(true) : this.openDialog()
        )
      );
    }

    return this.openDialog();
  }
}
