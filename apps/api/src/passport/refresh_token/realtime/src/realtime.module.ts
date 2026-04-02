import {Module} from "@nestjs/common";
import {RefreshTokenRealtimeGateway} from "./realtime.gateway";
import {RealtimeDatabaseModule} from "@spica-server/database/realtime";

@Module({})
export class RefreshTokenRealtimeModule {
  static register() {
    return {
      module: RefreshTokenRealtimeModule,
      imports: [RealtimeDatabaseModule],
      providers: [RefreshTokenRealtimeGateway]
    };
  }
}
