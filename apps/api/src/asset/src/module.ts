import {DynamicModule, Global, Module} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {AssetController} from "./controller";
import {AssetService} from "./service";

import {
  AssetOptions,
  ASSET_REP_MANAGER,
  ASSET_WORKING_DIRECTORY,
  INSTALLATION_STRATEGIES
} from "@spica-server/interface/asset";
import fs from "fs";

import AssetSchema from "../schema/asset.json" with {type: "json"};
import ConfigsSchema from "../schema/configs.json" with {type: "json"};
import ExportSchema from "../schema/export.json" with {type: "json"};
import {AssetRepManager} from "./representative";
import {installationStrategies} from "./strategies";

@Global()
@Module({})
export class AssetModule {
  static forRoot(options: AssetOptions): DynamicModule {
    return {
      module: AssetModule,
      imports: [
        SchemaModule.forChild({
          schemas: [AssetSchema, ConfigsSchema, ExportSchema]
        })
      ],
      controllers: [AssetController],
      providers: [
        AssetService,
        {
          provide: ASSET_WORKING_DIRECTORY,
          useFactory: () => {
            const dir = `${options.persistentPath}/asset`;
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, {recursive: true});
            }
            return dir;
          }
        },
        {
          provide: ASSET_REP_MANAGER,
          useFactory: dir => new AssetRepManager(dir),
          inject: [ASSET_WORKING_DIRECTORY]
        },
        {
          provide: INSTALLATION_STRATEGIES,
          useValue: installationStrategies
        }
      ],
      exports: [ASSET_REP_MANAGER]
    };
  }
}
