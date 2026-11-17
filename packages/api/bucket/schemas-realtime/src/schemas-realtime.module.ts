import {Module} from "@nestjs/common";
import {SchemasRealtimeGateway} from "./schemas-realtime.gateway.js";

@Module({})
export class SchemasRealtimeModule {
  static register() {
    return {
      module: SchemasRealtimeModule,
      providers: [SchemasRealtimeGateway]
    };
  }
}
