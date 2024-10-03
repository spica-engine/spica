import {Injectable} from "@angular/core";
import {ActivatedRouteSnapshot, Router, UrlTree} from "@angular/router";
import {Observable} from "rxjs";
import {map} from "rxjs/operators";
import {PassportService} from "./passport.service";

@Injectable({providedIn: "root"})
export class PolicyGuard {
  constructor(public passport: PassportService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> | boolean {
    if (route.data.action && route.data.service) {
      const action = `${route.data.service}:${route.data.action}`;
      const resource = route.data.params
        ? Object.values(route.data.params)
        : Object.values(route.params);
      if (route.data.action == "index") {
        resource.push("*");
      }
      return this.passport
        .checkAllowed(action, resource.join("/"))
        .pipe(map(allowed => (allowed ? allowed : this.router.createUrlTree(["/dashboard"]))));
    }
    return true;
  }

  canActivateChild(route: ActivatedRouteSnapshot) {
    return this.canActivate(route);
  }
}
