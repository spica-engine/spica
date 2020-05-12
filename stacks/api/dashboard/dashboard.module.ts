import {Module, DynamicModule} from "@nestjs/common";
import {DashboardController} from "./dashboard.controller";
import {DashboardService} from "./dashboard.service";

@Module({})
export class DashboardModule {
  static forRoot(): DynamicModule {
    return {
      module: DashboardModule,
      controllers: [DashboardController],
      providers: [DashboardService],
      exports: [DashboardService]
    };
  }

  constructor() {}
}
