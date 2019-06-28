import {Injectable} from "@angular/core";
import {ActivatedRouteSnapshot} from "@angular/router";
import {Observable} from "rxjs";
import {PassportService} from "./passport.service";

@Injectable({providedIn: "root"})
export class PolicyGuard {
  constructor(public passport: PassportService) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> | boolean {
    if (route.data.action && route.data.service) {
      return this.passport.checkAllowed(`${route.data.service}:${route.data.action}`);
    }
    return true;
  }

  canActivateChild(route: ActivatedRouteSnapshot) {
    return this.canActivate(route);
  }
}
