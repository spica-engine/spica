import {Module} from "@nestjs/common";
import {RealtimeGateway} from "./realtime.gateway";
import {RealtimeDatabaseModule} from "../../../../../../libs/database/realtime";

@Module({})
export class RealtimeModule {
  static register() {
    return {
      module: RealtimeModule,
      imports: [RealtimeDatabaseModule],
      providers: [RealtimeGateway]
    };
  }
}
