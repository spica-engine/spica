import {Module, DynamicModule, Optional, Inject} from "@nestjs/common";
import {DashboardController} from "./dashboard.controller";
import {DashboardService} from "./dashboard.service";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import DashboardSchema = require("../schema/dashboard.json");
import {ASSET_REP_MANAGER} from "@spica-server/asset/src/interface";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {registerAssetHandlers} from "./asset";

@Module({})
export class DashboardModule {
  constructor(
    ds: DashboardService,
    validator: Validator,
    @Optional() @Inject(ASSET_REP_MANAGER) private assetRepManager: IRepresentativeManager
  ) {
    registerAssetHandlers(ds, validator, assetRepManager);
  }
  static forRoot(): DynamicModule {
    return {
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
  }
}
