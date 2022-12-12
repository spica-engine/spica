import {Module} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {AssetController} from "./controller";
import {AssetService} from "./service";
import AssetSchema = require("../schema/asset.json");
import ConfigsSchema = require("../schema/configs.json");
import {AssetOptions, ASSET_REP_MANAGER, ASSET_WORKING_DIRECTORY} from "./interface";
import {RepresentativeManager} from "@spica-server/representative";
import * as fs from "fs";

@Module({})
export class AssetModule {
  static forRoot(options: AssetOptions) {
    return {
      module: AssetModule,
      imports: [
        SchemaModule.forChild({
          schemas: [AssetSchema, ConfigsSchema]
        })
      ],
      controllers: [AssetController],
      providers: [
        AssetService,
        {
          provide: ASSET_WORKING_DIRECTORY,
          useFactory: () => {
            const dir = `${options.persistentPath}/assets`;
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir);
            }
            return dir;
          }
        },
        {
          provide: ASSET_REP_MANAGER,
          useFactory: dir => new RepresentativeManager(dir),
          inject: [ASSET_WORKING_DIRECTORY]
        }
      ],
      exports: [ASSET_REP_MANAGER]
    };
  }
}
