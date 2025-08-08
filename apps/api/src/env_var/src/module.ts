import {DynamicModule, Inject, Module, Optional} from "@nestjs/common";
import {EnvVarService, ServicesModule} from "../services";
import {EnvVarController} from "./controller";
import {SchemaModule, Validator} from "../../../../../libs/core/schema";
import EnvVarSchema from "./schema.json" with {type: "json"};
import {IRepresentativeManager} from "../../../../../libs/interface/representative";
import {registerAssetHandlers} from "./asset";
import {
  REGISTER_VC_SYNCHRONIZER,
  RegisterVCSynchronizer
} from "../../../../../libs/interface/versioncontrol";
import {ASSET_REP_MANAGER} from "../../../../../libs/interface/asset";
import {EnvVar} from "../../../../../libs/interface/env_var";
import {getSynchronizer} from "./versioncontrol/synchronizer";
import {EnvVarRealtimeModule} from "../realtime";

@Module({})
export class EnvVarModule {
  static forRoot(options: {realtime: boolean}): DynamicModule {
    const imports = [
      SchemaModule.forChild({
        schemas: [EnvVarSchema]
      }),
      ServicesModule
    ];

    if (options.realtime) {
      imports.push(EnvVarRealtimeModule.register());
    }

    return {
      module: EnvVarModule,
      imports,
      controllers: [EnvVarController],
      providers: [EnvVarService],
      exports: []
    };
  }

  constructor(
    evs: EnvVarService,
    @Optional()
    @Inject(REGISTER_VC_SYNCHRONIZER)
    registerVCSynchronizer: RegisterVCSynchronizer<EnvVar>,
    @Optional() @Inject(ASSET_REP_MANAGER) private assetRepManager: IRepresentativeManager,
    validator: Validator
  ) {
    if (registerVCSynchronizer) {
      const synchronizer = getSynchronizer(evs);
      registerVCSynchronizer(synchronizer);
    }
    registerAssetHandlers(evs, validator, this.assetRepManager);
  }
}
