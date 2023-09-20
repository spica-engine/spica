import {Injectable} from "@angular/core";
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from "@angular/router";
import {select, Store} from "@ngrx/store";
import {map, switchMap, take} from "rxjs/operators";
import {BucketService} from "../services/bucket.service";
import * as fromBucket from "./bucket.reducer";

@Injectable({providedIn: "root"})
export class BucketIndexGuard  {
  constructor(
    private store: Store<fromBucket.State>,
    private bs: BucketService,
    private router: Router
  ) {}

  canActivate(_: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.store.pipe(
      select(fromBucket.selectLoaded),
      take(1),
      switchMap(loaded =>
        loaded
          ? this.store.pipe(select(fromBucket.selectEmpty))
          : this.bs
              .retrieve()
              .pipe(switchMap(() => this.store.pipe(select(fromBucket.selectEmpty))))
      ),
      take(1),
      map(empty => (empty ? this.router.createUrlTree([state.url, "welcome"]) : true))
    );
  }
}
