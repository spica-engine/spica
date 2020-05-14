import {Module} from "@nestjs/common";
import {DashboardController} from "./dashboard.controller";
import {DashboardService} from "./dashboard.service";
import {SchemaModule} from "@spica-server/core/schema";
const DashboardSchema = require("../schema/dashboard.json");

@Module({
  imports: [
    SchemaModule.forChild({
      schemas: [DashboardSchema]
    })
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService]
})
export class DashboardModule {}
