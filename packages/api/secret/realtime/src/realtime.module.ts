import {Module} from "@nestjs/common";
import {SecretRealtimeGateway} from "./realtime.gateway.js";

@Module({})
export class SecretRealtimeModule {
  static register() {
    return {
      module: SecretRealtimeModule,
      providers: [SecretRealtimeGateway]
    };
  }
}
