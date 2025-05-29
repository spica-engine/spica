import {Inject, Module, Optional} from "@nestjs/common";
import {EnvVarService, ServicesModule} from "@spica-server/env_var/services";
import {EnvVarController} from "./controller";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import EnvVarSchema from "./schema.json" with {type: "json"};
import {
  IRepresentativeManager,
  RepresentativeManagerResource
} from "@spica-server/interface/representative";
import {registerAssetHandlers} from "./asset";
import {
  VC_REPRESENTATIVE_MANAGER,
  REGISTER_VC_SYNCHRONIZER,
  RegisterVCSynchronizer
} from "@spica-server/interface/versioncontrol";
import {ASSET_REP_MANAGER} from "@spica-server/interface/asset";
import {EnvVar} from "@spica-server/interface/env_var";
import {getSynchronizer} from "./versioncontrol/synchronizer";

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
    @Optional()
    @Inject(VC_REPRESENTATIVE_MANAGER)
    private vcRepresentativeManager: IRepresentativeManager,
    @Optional()
    @Inject(REGISTER_VC_SYNCHRONIZER)
    registerVCSynchronizer: RegisterVCSynchronizer<EnvVar, RepresentativeManagerResource>,
    @Optional() @Inject(ASSET_REP_MANAGER) private assetRepManager: IRepresentativeManager,
    validator: Validator
  ) {
    if (registerVCSynchronizer) {
      const synchronizer = getSynchronizer(evs, this.vcRepresentativeManager);
      registerVCSynchronizer(synchronizer);
    }
    registerAssetHandlers(evs, validator, this.assetRepManager);
  }
}
