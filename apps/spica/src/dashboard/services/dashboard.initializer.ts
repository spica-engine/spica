import {Injectable} from "@angular/core";
import {RouteCategory, RouteService, Upsert} from "@spica-client/core";
import {CherryPickAndRemove, RemoveCategory} from "@spica-client/core/route";
import {PassportService} from "../../passport";
import {DashboardService} from "./dashboard.service";

@Injectable()
export class DashboardInitializer {
  constructor(
    private ds: DashboardService,
    private routeService: RouteService,
    private passport: PassportService
  ) {
    ds.findAll().subscribe(dashboards => {
      this.routeService.dispatch(new CherryPickAndRemove(e => e.id.startsWith("dashboard/")));
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Dashboard));
      dashboards.forEach(dashboard => {
        this.routeService.dispatch(
          new Upsert({
            category: RouteCategory.Dashboard,
            id: `dashboard/${dashboard._id}`,
            icon: dashboard.icon,
            path: `/dashboard/${dashboard._id}`,
            display: dashboard.name
          })
        );
      });
      this.routeService.dispatch(
        new Upsert({
          id: "add-dashboard",
          category: RouteCategory.Dashboard,
          icon: "add",
          path: "/dashboards/add",
          display: "Add New Dashboard",
          customClass: "dashed-item"
        })
      );
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
