import {Module} from "@nestjs/common";
import {userRealtimeGateway} from "./realtime.gateway";
import {RealtimeDatabaseModule} from "@spica-server/database/realtime";

@Module({})
export class userRealtimeModule {
  static register() {
    return {
      module: userRealtimeModule,
      imports: [RealtimeDatabaseModule],
      providers: [userRealtimeGateway]
    };
  }
}
