import {Injectable} from "@angular/core";
import {RouteCategory, RouteService, Upsert} from "@spica-client/core";
import {CherryPickAndRemove} from "@spica-server/core/route/route.reducer";
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
      this.routeService.dispatch(new CherryPickAndRemove(e => e.id.startsWith("dashboard/")));
      dashboards.forEach(dashboard => {
        this.routeService.dispatch(
          new Upsert({
            category: RouteCategory.Primary,
            id: `dashboard/${dashboard.key}`,
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
      // Remove dashboard items if the user has no permission to see.
      this.routeService.dispatch(new CherryPickAndRemove(e => e.id.startsWith("dashboard/")));
    }
  }
}
