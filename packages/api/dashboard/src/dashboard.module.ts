import {Module, DynamicModule, Optional, Inject} from "@nestjs/common";
import {DashboardController} from "./dashboard.controller.js";
import {SchemaModule, Validator} from "@spica-server/core-schema";
import DashboardSchema from "./schema/dashboard.json" with {type: "json"};
import {ASSET_REP_MANAGER} from "@spica-server/interface-asset";
import {IRepresentativeManager} from "@spica-server/interface-representative";
import {registerAssetHandlers} from "./asset.js";
import {DashboardRealtimeModule} from "@spica-server/dashboard-realtime";
import {provideRepository} from "@spica-server/data";
import {DASHBOARD_REPOSITORY, DashboardRepository} from "@spica-server/interface-dashboard";

@Module({})
export class DashboardModule {
  constructor(
    @Inject(DASHBOARD_REPOSITORY) dashboards: DashboardRepository,
    validator: Validator,
    @Optional() @Inject(ASSET_REP_MANAGER) private assetRepManager: IRepresentativeManager
  ) {
    registerAssetHandlers(dashboards, validator, assetRepManager);
  }
  static forRoot({realtime}): DynamicModule {
    const module: DynamicModule = {
      module: DashboardModule,
      imports: [
        SchemaModule.forChild({
          schemas: [DashboardSchema]
        })
      ],
      controllers: [DashboardController],
      providers: [provideRepository(DASHBOARD_REPOSITORY)],
      exports: [DASHBOARD_REPOSITORY]
    };

    if (realtime) {
      module.imports.push(DashboardRealtimeModule.register());
    }
    return module;
  }
}
