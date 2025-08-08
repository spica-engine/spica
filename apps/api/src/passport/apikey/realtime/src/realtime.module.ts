import {Module} from "@nestjs/common";
import {ApikeyRealtimeGateway} from "./realtime.gateway";
import {RealtimeDatabaseModule} from "../../../../../../../libs/database/realtime";

@Module({})
export class ApikeyRealtimeModule {
  static register() {
    return {
      module: ApikeyRealtimeModule,
      imports: [RealtimeDatabaseModule],
      providers: [ApikeyRealtimeGateway]
    };
  }
}
