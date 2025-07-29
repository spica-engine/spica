import {Module} from "@nestjs/common";
import {RealtimeDashboardService} from "./realtime.gateway";
import {RealtimeDatabaseModule} from "@spica-server/database/realtime";

@Module({})
export class DashboardRealtimeModule {
  static register() {
    return {
      module: DashboardRealtimeModule,
      imports: [RealtimeDatabaseModule],
      providers: [RealtimeDashboardService]
    };
  }
}
