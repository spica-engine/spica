import {Module, DynamicModule, Optional, Inject} from "@nestjs/common";
import {DashboardController} from "./dashboard.controller";
import {DashboardService} from "./dashboard.service";
import {SchemaModule, Validator} from "../../../../../libs/core/schema";
import DashboardSchema from "./schema/dashboard.json" with {type: "json"};
import {ASSET_REP_MANAGER} from "../../../../../libs/interface/asset";
import {IRepresentativeManager} from "../../../../../libs/interface/representative";
import {registerAssetHandlers} from "./asset";
import {DashboardRealtimeModule} from "../realtime";
@Module({})
export class DashboardModule {
  constructor(
    ds: DashboardService,
    validator: Validator,
    @Optional() @Inject(ASSET_REP_MANAGER) private assetRepManager: IRepresentativeManager
  ) {
    registerAssetHandlers(ds, validator, assetRepManager);
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
      providers: [DashboardService],
      exports: [DashboardService]
    };

    if (realtime) {
      module.imports.push(DashboardRealtimeModule.register());
    }
    return module;
  }
}
