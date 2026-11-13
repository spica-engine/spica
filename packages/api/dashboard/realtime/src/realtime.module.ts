import {Module} from "@nestjs/common";
import {RealtimeDashboardService} from "./realtime.gateway.js";

@Module({})
export class DashboardRealtimeModule {
  static register() {
    return {
      module: DashboardRealtimeModule,
      providers: [RealtimeDashboardService]
    };
  }
}
