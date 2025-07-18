import {Module} from "@nestjs/common";
import {RealtimeFunctionService} from "./realtime.gateway";
import {RealtimeDatabaseModule} from "@spica-server/database/realtime";

@Module({})
export class FunctionRealtimeModule {
  static listen() {
    return {
      module: FunctionRealtimeModule,
      imports: [RealtimeDatabaseModule],
      providers: [RealtimeFunctionService]
    };
  }
}
