import {Injectable} from "@angular/core";
import {ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot} from "@angular/router";
import {select, Store} from "@ngrx/store";
import {map, switchMap, take} from "rxjs/operators";
import {FunctionService} from "../services/function.service";
import * as fromFunction from "../reducers/function.reducer";

@Injectable({providedIn: "root"})
export class FunctionIndexGuard implements CanActivate {
  constructor(
    private store: Store<fromFunction.State>,
    private fs: FunctionService,
    private router: Router
  ) {}

  canActivate(_: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.store.pipe(
      select(fromFunction.selectLoaded),
      take(1),
      switchMap(loaded =>
        loaded
          ? this.store.pipe(select(fromFunction.selectEmpty))
          : this.fs
              .loadFunctions()
              .pipe(switchMap(() => this.store.pipe(select(fromFunction.selectEmpty))))
      ),
      map(empty => (empty ? this.router.createUrlTree(["function", "welcome"]) : true))
    );
  }
}
