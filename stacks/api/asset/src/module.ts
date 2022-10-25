import {Module} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {AssetController} from "./controller";
import {AssetService} from "./service";
import AssetSchema = require("../schema/asset.json");

@Module({
  controllers: [AssetController],
  providers: [AssetService],
  imports: [
    SchemaModule.forChild({
      schemas: [AssetSchema]
    })
  ]
})
export class AssetModule {}
