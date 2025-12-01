import {Module} from "@nestjs/common";
import {UserRealtimeGateway} from "./realtime.gateway";
import {RealtimeDatabaseModule} from "@spica-server/database/realtime";

@Module({})
export class UserRealtimeModule {
  static register() {
    return {
      module: UserRealtimeModule,
      imports: [RealtimeDatabaseModule],
      providers: [UserRealtimeGateway]
    };
  }
}
