import {Global, Module} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {AssetController} from "./controller";
import {AssetService} from "./service";

import {AssetOptions, ASSET_REP_MANAGER, ASSET_WORKING_DIRECTORY} from "./interface";
import * as fs from "fs";

import AssetSchema = require("../schema/asset.json");
import ConfigsSchema = require("../schema/configs.json");
import ExportSchema = require("../schema/export.json");
import {AssetRepManager} from "./representative";

@Global()
@Module({})
export class AssetModule {
  static forRoot(options: AssetOptions) {
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
        }
      ],
      exports: [ASSET_REP_MANAGER]
    };
  }
}
