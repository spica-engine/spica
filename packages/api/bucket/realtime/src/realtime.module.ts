import {Module} from "@nestjs/common";
import {RealtimeGateway} from "./realtime.gateway.js";

@Module({})
export class RealtimeModule {
  static register() {
    return {
      module: RealtimeModule,
      imports: [] as any[],
      providers: [RealtimeGateway]
    };
  }
}
