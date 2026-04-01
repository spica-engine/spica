import {Module} from "@nestjs/common";
import {EnvVarRealtimeGateway} from "./realtime.gateway.js";
import {RealtimeDatabaseModule} from "@spica-server/database/realtime";

@Module({})
export class EnvVarRealtimeModule {
  static register() {
    return {
      module: EnvVarRealtimeModule,
      imports: [RealtimeDatabaseModule],
      providers: [EnvVarRealtimeGateway]
    };
  }
}
