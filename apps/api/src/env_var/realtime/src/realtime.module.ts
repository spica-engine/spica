import {Module} from "@nestjs/common";
import {EnvVarRealtimeGateway} from "./realtime.gateway";
import {RealtimeDatabaseModule} from "../../../../../../libs/database/realtime";

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
