import {Module} from "@nestjs/common";
import {LogController} from "./log.controller";
import {LogService} from "./log.service";
import {LogGateway} from "./realtime.gateway";
import {RealtimeDatabaseModule} from "@spica-server/database/realtime";

@Module({
  imports: [RealtimeDatabaseModule],
  controllers: [LogController],
  providers: [LogService, LogGateway]
})
export class LogModule {}
