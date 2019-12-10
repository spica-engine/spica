import {Injectable} from "@angular/core";
import {RemoveCategory, RouteCategory, RouteService, Upsert} from "@spica-client/core";
import {PassportService} from "../../passport";
import {DashboardService} from "./dashboard.service";

@Injectable()
export class DashboardInitializer {
  constructor(
    private ds: DashboardService,
    private routeService: RouteService,
    private passport: PassportService
  ) {
    ds.getDashboards().subscribe(dashboards => {
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Content));
      dashboards.forEach(dashboard => {
        this.routeService.dispatch(
          new Upsert({
            category: RouteCategory.Primary,
            id: `dashboard_${dashboard.key}`,
            icon: dashboard.icon,
            path: `/dashboard/${dashboard.key}`,
            display: dashboard.name
          })
        );
      });
    });
  }

  async appInitializer() {
    if (
      this.passport.identified &&
      (await this.passport.checkAllowed("dashboard:index").toPromise())
    ) {
      this.ds.retrieve().toPromise();
    } else {
      // Clean up the content category if the user has no permission to see.
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Content));
    }
  }
}
