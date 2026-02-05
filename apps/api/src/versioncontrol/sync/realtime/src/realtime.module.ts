import {Module} from "@nestjs/common";
import {SyncRealtimeGateway} from "./realtime.gateway";
import {RealtimeDatabaseModule} from "@spica-server/database/realtime";

@Module({})
export class SyncRealtimeModule {
  static register() {
    return {
      module: SyncRealtimeModule,
      imports: [RealtimeDatabaseModule],
      providers: [SyncRealtimeGateway]
    };
  }
}
