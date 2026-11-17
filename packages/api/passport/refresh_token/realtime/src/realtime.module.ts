import {Module} from "@nestjs/common";
import {RefreshTokenRealtimeGateway} from "./realtime.gateway.js";

@Module({})
export class RefreshTokenRealtimeModule {
  static register() {
    return {
      module: RefreshTokenRealtimeModule,
      providers: [RefreshTokenRealtimeGateway]
    };
  }
}
