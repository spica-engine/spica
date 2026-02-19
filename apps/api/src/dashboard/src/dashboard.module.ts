import {Module, DynamicModule, Optional, Inject} from "@nestjs/common";
import {DashboardController} from "./dashboard.controller";
import {DashboardService} from "./dashboard.service";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import DashboardSchema from "./schema/dashboard.json" with {type: "json"};
import {ASSET_REP_MANAGER} from "@spica-server/interface/asset";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {registerAssetHandlers} from "./asset";
import {DashboardRealtimeModule} from "../realtime";
import {
  REGISTER_VC_CHANGE_HANDLER,
  RegisterVCChangeHandler
} from "@spica-server/interface/versioncontrol";
import {getSupplier, getApplier} from "./synchronizer/schema";

@Module({})
export class DashboardModule {
  constructor(
    ds: DashboardService,
    validator: Validator,
    @Optional() @Inject(ASSET_REP_MANAGER) private assetRepManager: IRepresentativeManager,
    @Optional()
    @Inject(REGISTER_VC_CHANGE_HANDLER)
    registerVCChangeHandler: RegisterVCChangeHandler
  ) {
    if (registerVCChangeHandler) {
      registerVCChangeHandler(getSupplier(ds), getApplier(ds));
    }
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
