import {Module} from "@nestjs/common";
import {Request} from "./request";
import {Websocket} from "./websocket";

@Module({
  providers: [Request, Websocket],
  exports: [Request, Websocket]
})
export class CoreTestingModule {}
