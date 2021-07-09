import {Module} from "@nestjs/common";
import {ApiMachineryController, ApiMachineryObjectController} from "./controller";

@Module({
  controllers: [ApiMachineryObjectController, ApiMachineryController]
})
export class ApiMachineryModule {}
