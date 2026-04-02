import {Module} from "@nestjs/common";
import {PolicyRealtimeGateway} from "./realtime.gateway";
import {RealtimeDatabaseModule} from "@spica-server/database/realtime";

@Module({})
export class PolicyRealtimeModule {
  static register() {
    return {
      module: PolicyRealtimeModule,
      imports: [RealtimeDatabaseModule],
      providers: [PolicyRealtimeGateway]
    };
  }
}
