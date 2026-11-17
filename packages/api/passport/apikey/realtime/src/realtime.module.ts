import {Module} from "@nestjs/common";
import {ApikeyRealtimeGateway} from "./realtime.gateway.js";

@Module({})
export class ApikeyRealtimeModule {
  static register() {
    return {
      module: ApikeyRealtimeModule,
      providers: [ApikeyRealtimeGateway]
    };
  }
}
