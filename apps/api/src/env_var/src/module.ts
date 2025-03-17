import {Inject, Module, Optional} from "@nestjs/common";
import {EnvVarsService, ServicesModule} from "@spica-server/env_var/services";
import {EnvVarsController} from "./controller";
import {SchemaModule} from "@spica-server/core/schema";
import EnvVarsSchema from "./schema.json" with {type: "json"};
import {
  REGISTER_VC_SYNC_PROVIDER,
  RegisterSyncProvider,
  VC_REP_MANAGER
} from "@spica-server/versioncontrol";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {getVCSyncProvider} from "./versioncontrol/env-var";

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
    @Optional() @Inject(VC_REP_MANAGER) private vcRepManager: IRepresentativeManager,
    @Optional() @Inject(REGISTER_VC_SYNC_PROVIDER) registerVCSyncProvider: RegisterSyncProvider
  ) {
    if (registerVCSyncProvider) {
      const provider = getVCSyncProvider(this.vcRepManager);
      registerVCSyncProvider(provider);
    }
  }
}
