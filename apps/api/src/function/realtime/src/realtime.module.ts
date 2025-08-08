import {Module} from "@nestjs/common";
import {RealtimeFunctionService} from "./realtime.gateway";
import {RealtimeDatabaseModule} from "../../../../../../libs/database/realtime";

@Module({})
export class FunctionRealtimeModule {
  static register() {
    return {
      module: FunctionRealtimeModule,
      imports: [RealtimeDatabaseModule],
      providers: [RealtimeFunctionService]
    };
  }
}
