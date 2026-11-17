import {Module} from "@nestjs/common";
import {PolicyRealtimeGateway} from "./realtime.gateway.js";

@Module({})
export class PolicyRealtimeModule {
  static register() {
    return {
      module: PolicyRealtimeModule,
      providers: [PolicyRealtimeGateway]
    };
  }
}
