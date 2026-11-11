import {Module} from "@nestjs/common";
import {IdentityRealtimeGateway} from "./realtime.gateway.js";

@Module({})
export class IdentityRealtimeModule {
  static register() {
    return {
      module: IdentityRealtimeModule,
      providers: [IdentityRealtimeGateway]
    };
  }
}
