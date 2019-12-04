import {Injectable} from "@angular/core";
import {RemoveCategory, RouteCategory, Upsert, RouteService} from "@spica-client/core";
import {DashboardService} from "./dashboard.service";
import {PassportService} from "../../passport";

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
        let title = "";
        dashboard[0].split("-").forEach((element, index) => {
          if (index == 0) {
            title = title + element.charAt(0).toUpperCase() + element.slice(1);
          }
          else {
            title = title + " "+ element.charAt(0).toUpperCase() + element.slice(1);
          }
        });
        this.routeService.dispatch(
          new Upsert({
            category: RouteCategory.Primary,
            id: `dashboard_${dashboard[0]}`,
            icon: "dashboard",
            path: `/dashboard/${dashboard[0]}`,
            display: title
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
