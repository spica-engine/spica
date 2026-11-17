import {Module} from "@nestjs/common";
import {UserRealtimeGateway} from "./realtime.gateway.js";

@Module({})
export class UserRealtimeModule {
  static register() {
    return {
      module: UserRealtimeModule,
      providers: [UserRealtimeGateway]
    };
  }
}
