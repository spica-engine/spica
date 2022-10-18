import {Injectable} from "@angular/core";
import {RouteCategory, RouteService, Upsert} from "@spica-client/core";
import {CherryPickAndRemove, RemoveCategory} from "@spica-client/core/route";
import {PassportService} from "../passport";
import { titleCase } from "./interface";
import {AssetService} from "./services/asset.service";

@Injectable()
export class AssetInitializer {
  constructor(
    private as: AssetService,
    private routeService: RouteService,
    private passport: PassportService
  ) {
    as.find().subscribe(assets => {
      this.routeService.dispatch(new CherryPickAndRemove(e => e.id.startsWith("assets/")));
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Asset));
      const packages = new Set(assets.map(asset => asset.metadata.package));
      packages.forEach(packageName =>
        this.routeService.dispatch(
          new Upsert({
            category: RouteCategory.Asset,
            id: `assets/${packageName}`,
            icon: "extension",
            path: `assets/${packageName}`,
            display: titleCase(packageName)
          })
        )
      );

      this.routeService.dispatch(
        new Upsert({
          id: "add-asset",
          category: RouteCategory.Asset,
          icon: "add",
          path: "/assets/add",
          display: "Add New Asset",
          customClass: "dashed-item"
        })
      );
    });
  }

  async appInitializer() {
    if (this.passport.identified && (await this.passport.checkAllowed("apis:index").toPromise())) {
      this.as.find().toPromise();
    } else {
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Primary_Sub));
      // Remove asset items if the user has no permission to see.
      this.routeService.dispatch(new CherryPickAndRemove(e => e.id.startsWith("asset/")));
    }
  }
}
