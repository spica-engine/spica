import {Module} from "@nestjs/common";
import {FunctionRealtimeGateway} from "./realtime.gateway";
import {RealtimeDatabaseModule} from "@spica-server/database/realtime";

@Module({
  imports: [RealtimeDatabaseModule],
  providers: [FunctionRealtimeGateway]
})
export class FunctionRealtimeModule {}
