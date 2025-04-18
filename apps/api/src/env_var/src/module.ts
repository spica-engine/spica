import {Inject, Module, Optional} from "@nestjs/common";
import {EnvVarService, ServicesModule} from "@spica-server/env_var/services";
import {EnvVarController} from "./controller";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import EnvVarSchema from "./schema.json" with {type: "json"};
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {getVCSyncProvider} from "./versioncontrol/schema";
import {registerAssetHandlers} from "./asset";
import {
  RegisterSyncProvider,
  VC_REP_MANAGER,
  REGISTER_VC_SYNC_PROVIDER
} from "@spica-server/interface/versioncontrol";
import {ASSET_REP_MANAGER} from "@spica-server/interface/asset";

@Module({})
export class EnvVarModule {
  static forRoot() {
    return {
      module: EnvVarModule,
      imports: [
        SchemaModule.forChild({
          schemas: [EnvVarSchema]
        }),
        ServicesModule
      ],
      controllers: [EnvVarController],
      providers: [EnvVarService],
      exports: []
    };
  }

  constructor(
    evs: EnvVarService,
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
