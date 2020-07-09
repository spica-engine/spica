import {Module} from "@nestjs/common";
import {LogController} from "./log.controller";
import {LogService} from "./log.service";
import {RealtimeModule} from "./realtime";

@Module({
  imports: [RealtimeModule],
  controllers: [LogController],
  providers: [LogService]
})
export class LogModule {}
