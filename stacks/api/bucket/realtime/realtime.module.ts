import {Module} from "@nestjs/common";
import {RealtimeGateway} from "./realtime.gateway";
import {RealtimeDatabaseModule} from "@spica-server/database/realtime";

@Module({
  imports: [RealtimeDatabaseModule],
  providers: [RealtimeGateway]
})
export class RealtimeModule {}
