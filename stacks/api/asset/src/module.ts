import {Module} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {AssetController} from "./controller";
import {AssetService} from "./service";
import AssetSchema = require("../schema/asset.json");
import ConfigsSchema = require("../schema/configs.json");

@Module({
  controllers: [AssetController],
  providers: [AssetService],
  imports: [
    SchemaModule.forChild({
      schemas: [AssetSchema,ConfigsSchema]
    })
  ]
})
export class AssetModule {}
