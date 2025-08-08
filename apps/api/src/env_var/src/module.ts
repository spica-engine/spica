import {DynamicModule, Inject, Module, Optional} from "@nestjs/common";
import {EnvVarService, ServicesModule} from "@spica-server/env_var/services";
import {EnvVarController} from "./controller";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import EnvVarSchema from "./schema.json" with {type: "json"};
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {registerAssetHandlers} from "./asset";
import {
  REGISTER_VC_SYNCHRONIZER,
  RegisterVCSynchronizer
} from "@spica-server/interface/versioncontrol";
import {ASSET_REP_MANAGER} from "@spica-server/interface/asset";
import {EnvVar} from "@spica-server/interface/env_var";
import {getSynchronizer} from "./versioncontrol/synchronizer";
import {EnvVarRealtimeModule} from "@spica-server/env_var/realtime";

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
