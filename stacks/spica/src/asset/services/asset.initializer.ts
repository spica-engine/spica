import {Injectable} from "@angular/core";
import {RemoveCategory, RouteCategory, RouteService, Upsert} from "@spica-client/core";
import {PassportService} from "../../passport";
import {AssetService} from "./asset.service";

@Injectable()
export class AssetInitializer {
  constructor(
    private as: AssetService,
    private routeService: RouteService,
    private passport: PassportService
  ) {
    as.find().subscribe(assets => {
      assets = assets.filter(asset => asset.status == "installed");
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Asset));
      assets.forEach(asset => {
        this.routeService.dispatch(
          new Upsert({
            category: RouteCategory.Asset,
            id: `assets/${asset._id}`,
            icon: "check",
            path: `/assets/${asset._id}`,
            display: asset.name
          })
        );
      });

      this.routeService.dispatch(
        new Upsert({
          id: "add-asset",
          category: RouteCategory.Asset,
          icon: "add",
          path: `/assetstore`,
          display: "Add Asset"
        })
      );
    });
  }

  async appInitializer() {
    const allowed = await this.passport.checkAllowed("asset:index", "*").toPromise();
    if (this.passport.identified && allowed) {
      this.as.retrieve().toPromise();
    } else {
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Content));
    }
  }
}
