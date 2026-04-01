import {Module} from "@nestjs/common";
import {SecretRealtimeGateway} from "./realtime.gateway.js";
import {RealtimeDatabaseModule} from "@spica-server/database/realtime";

@Module({})
export class SecretRealtimeModule {
  static register() {
    return {
      module: SecretRealtimeModule,
      imports: [RealtimeDatabaseModule],
      providers: [SecretRealtimeGateway]
    };
  }
}
