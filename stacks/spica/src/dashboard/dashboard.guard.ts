import {Injectable} from "@angular/core";
import {ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot} from "@angular/router";
import {select, Store} from "@ngrx/store";
import {map, switchMap, take} from "rxjs/operators";
import {DashboardService} from "./services/dashboard.service";
import * as fromDashboard from "./state/dashboard.reducer";

@Injectable({providedIn: "root"})
export class DashboardIndexGuard implements CanActivate {
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
