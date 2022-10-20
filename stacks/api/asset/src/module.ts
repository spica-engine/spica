import {Module} from "@nestjs/common";
import {AssetController} from "./controller";
import {AssetService} from "./service";

@Module({controllers: [AssetController], providers: [AssetService]})
export class AssetModule {}
