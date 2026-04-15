import {Global, Module, Inject, Optional} from "@nestjs/common";
import {VersionControlController} from "./controller.js";
import {VersionManager} from "./interface.js";
import {
  VersionControlOptions,
  VERSIONCONTROL_WORKING_DIRECTORY,
  VC_REPRESENTATIVE_MANAGER,
  REGISTER_VC_CHANGE_HANDLER,
  DocumentChangeSupplier,
  DocumentChangeApplier
} from "@spica-server/interface-versioncontrol";
import {REGISTER_CONFIG_SCHEMA, RegisterConfigSchema} from "@spica-server/interface-config";
import {VCRepresentativeManager} from "@spica-server/representative";
import {Git} from "./versionmanager.js";
import fs from "fs";
import {SyncModule} from "@spica-server/versioncontrol-sync";
import {SyncEngine, SyncEngineModule} from "@spica-server/versioncontrol-sync-engine";

@Global()
@Module({})
export class VersionControlModule {
  constructor(
    @Optional()
    @Inject(REGISTER_CONFIG_SCHEMA)
    registerConfigSchema: RegisterConfigSchema
  ) {
    if (registerConfigSchema) {
      registerConfigSchema("versioncontrol", {
        type: "object",
        properties: {
          autoApproveSync: {
            type: "object",
            properties: {
              document: {type: "boolean"},
              representative: {type: "boolean"}
            }
          }
        }
      });
    }
  }

  static forRoot(options: VersionControlOptions) {
    return {
      module: VersionControlModule,
      controllers: [VersionControlController],
      imports: [
        SyncModule.forRoot({realtime: options.realtime}),
        SyncEngineModule.forRoot({isReplicationEnabled: options.isReplicationEnabled})
      ],
      providers: [
        {
          provide: VERSIONCONTROL_WORKING_DIRECTORY,
          useFactory: () => {
            const dir = `${options.persistentPath}/representatives`;
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir);
            }
            return dir;
          }
        },
        {
          provide: VersionManager,
          useFactory: (cwd, jr) => new Git(cwd, jr),
          inject: [VERSIONCONTROL_WORKING_DIRECTORY]
        },
        {
          provide: VC_REPRESENTATIVE_MANAGER,
          useFactory: dir => new VCRepresentativeManager(dir),
          inject: [VERSIONCONTROL_WORKING_DIRECTORY]
        },
        {
          provide: REGISTER_VC_CHANGE_HANDLER,
          useFactory: (engine: SyncEngine) => {
            return (supplier: DocumentChangeSupplier, applier: DocumentChangeApplier) => {
              engine.registerChangeHandler(supplier, applier);
            };
          },
          inject: [SyncEngine]
        }
      ],
      exports: [REGISTER_VC_CHANGE_HANDLER, VC_REPRESENTATIVE_MANAGER]
    };
  }
}
