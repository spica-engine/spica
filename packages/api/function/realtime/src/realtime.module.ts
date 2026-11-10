import {Module} from "@nestjs/common";
import {RealtimeFunctionService} from "./realtime.gateway.js";

@Module({})
export class FunctionRealtimeModule {
  static register() {
    return {
      module: FunctionRealtimeModule,
      providers: [RealtimeFunctionService]
    };
  }
}
