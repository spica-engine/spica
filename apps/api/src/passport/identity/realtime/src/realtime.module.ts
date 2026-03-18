import {Module} from "@nestjs/common";
import {IdentityRealtimeGateway} from "./realtime.gateway";
import {RealtimeDatabaseModule} from "@spica-server/database/realtime";

@Module({})
export class IdentityRealtimeModule {
  static register() {
    return {
      module: IdentityRealtimeModule,
      imports: [RealtimeDatabaseModule],
      providers: [IdentityRealtimeGateway]
    };
  }
}
