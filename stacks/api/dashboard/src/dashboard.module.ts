import {Module, DynamicModule} from "@nestjs/common";
import {DashboardController} from "./dashboard.controller";
import {DashboardService} from "./dashboard.service";
import {SchemaModule} from "@spica-server/core/schema";
import DashboardSchema = require("../schema/dashboard.json");

@Module({})
export class DashboardModule {
  constructor() {}
  static forRoot(): DynamicModule {
    return {
      module: DashboardModule,
      imports: [
        SchemaModule.forChild({
          schemas: [DashboardSchema]
        })
      ],
      controllers: [DashboardController],
      providers: [DashboardService],
      exports: [DashboardService]
    };
  }
}
