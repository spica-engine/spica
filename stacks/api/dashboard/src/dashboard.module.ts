import {Module, DynamicModule} from "@nestjs/common";
import {DashboardController} from "./dashboard.controller";
import {DashboardService} from "./dashboard.service";
import {SchemaModule} from "@spica-server/core/schema";
import {registerInformers} from "./machinery";
const DashboardSchema = require("../schema/dashboard.json");

@Module({})
export class DashboardModule {
  constructor(dashboardService: DashboardService) {
    registerInformers(dashboardService);
  }
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
