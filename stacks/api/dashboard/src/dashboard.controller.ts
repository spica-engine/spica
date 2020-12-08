import {
  Controller,
  Get,
  UseGuards,
  Param,
  Body,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  Post
} from "@nestjs/common";
import {ActionGuard, AuthGuard} from "@spica-server/passport";
import {DashboardService} from "./dashboard.service";
import {Dashboard} from "./dashboard";
import {Schema} from "@spica-server/core/schema";
import {ResourceFilter} from "@spica-server/passport/guard";
import {OBJECT_ID, ObjectId} from "@spica-server/database";

@Controller("dashboard")
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  @UseGuards(AuthGuard())
  findAll() {
    return this.dashboardService.find();
  }

  @Get(":id")
  @UseGuards(AuthGuard())
  findById(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.dashboardService.findOne({_id: id});
  }

  @Post()
  @UseGuards(AuthGuard())
  insert(@Body(Schema.validate("http://spica.internal/dashboard")) dashboard: Dashboard) {
    return this.dashboardService.insertOne(dashboard);
  }

  @Put(":id")
  @UseGuards(AuthGuard())
  update(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/dashboard"))
    dashboard: Dashboard
  ) {
    return this.dashboardService.findOneAndReplace({_id: id}, dashboard, {returnOriginal: false});
  }

  @Delete(":id")
  @UseGuards(AuthGuard())
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.dashboardService.deleteOne({_id: id});
  }
}
