import {Module} from "@nestjs/common";
import {SchemasRealtimeGateway} from "./schemas-realtime.gateway";
import {RealtimeDatabaseModule} from "@spica-server/database/realtime";

@Module({})
export class SchemasRealtimeModule {
  static register() {
    return {
      module: SchemasRealtimeModule,
      imports: [RealtimeDatabaseModule],
      providers: [SchemasRealtimeGateway]
    };
  }
}
