import {Module} from "@nestjs/common";
import {EnvVarRealtimeGateway} from "./realtime.gateway.js";

@Module({})
export class EnvVarRealtimeModule {
  static register() {
    return {
      module: EnvVarRealtimeModule,
      providers: [EnvVarRealtimeGateway]
    };
  }
}
