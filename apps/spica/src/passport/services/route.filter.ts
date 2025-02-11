import {Injectable} from "@angular/core";
import {Route, RouteFilter} from "@spica-client/core/route";
import {PassportService} from "./passport.service";

@Injectable({providedIn: "root"})
export class PassportRouteFilter implements RouteFilter {
  constructor(public passport: PassportService) {}

  filter(route: Route) {
    if (route.data && route.data.action) {
      let resource = route.data.params ? Object.values(route.data.params).join("/") : undefined;
      return this.passport.checkAllowed(route.data.action, resource);
    }
    return true;
  }
}
