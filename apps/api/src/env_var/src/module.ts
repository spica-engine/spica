import {Inject, Module, Optional} from "@nestjs/common";
import {EnvVarsService, ServicesModule} from "@spica-server/env_var/services";
import {EnvVarsController} from "./controller";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import EnvVarsSchema from "./schema.json" with {type: "json"};
import {
  REGISTER_VC_SYNC_PROVIDER,
  RegisterSyncProvider,
  VC_REP_MANAGER
} from "@spica-server/versioncontrol";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {getVCSyncProvider} from "./versioncontrol/schema";
import {registerAssetHandlers} from "./asset";
import {ASSET_REP_MANAGER} from "@spica-server/asset/src/interface";

@Module({})
export class EnvVarsModule {
  static forRoot() {
    return {
      module: EnvVarsModule,
      imports: [
        SchemaModule.forChild({
          schemas: [EnvVarsSchema]
        }),
        ServicesModule
      ],
      controllers: [EnvVarsController],
      providers: [EnvVarsService],
      exports: []
    };
  }

  constructor(
    evs: EnvVarsService,
    @Optional() @Inject(VC_REP_MANAGER) private vcRepManager: IRepresentativeManager,
    @Optional() @Inject(REGISTER_VC_SYNC_PROVIDER) registerVCSyncProvider: RegisterSyncProvider,
    @Optional() @Inject(ASSET_REP_MANAGER) private assetRepManager: IRepresentativeManager,
    validator: Validator
  ) {
    if (registerVCSyncProvider) {
      const provider = getVCSyncProvider(evs, this.vcRepManager);
      registerVCSyncProvider(provider);
    }
    registerAssetHandlers(evs, validator, this.assetRepManager);
  }
}
