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
  Post,
  HttpException
} from "@nestjs/common";
import {ActionGuard, AuthGuard} from "@spica-server/passport/guard";
import {DashboardService} from "./dashboard.service";
import {Dashboard} from "@spica-server/interface/dashboard";
import {Schema} from "@spica-server/core/schema";
import {ResourceFilter} from "@spica-server/passport/guard";
import {OBJECT_ID, ObjectId} from "@spica-server/database";
import * as CRUD from "./crud";

@Controller("dashboard")
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("dashboard:index"))
  findAll(@ResourceFilter() resourceFilter: object) {
    return CRUD.find(this.dashboardService, resourceFilter);
  }

  @Get(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("dashboard:show"))
  findById(@Param("id", OBJECT_ID) id: ObjectId) {
    return CRUD.findOne(this.dashboardService, id);
  }

  @Post()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("dashboard:create"))
  insert(@Body(Schema.validate("http://spica.internal/dashboard")) dashboard: Dashboard) {
    return CRUD.insert(this.dashboardService, dashboard).catch(e => {
      throw new HttpException(e.message, e.status || 500);
    });
  }

  @Put(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("dashboard:update"))
  async update(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/dashboard"))
    dashboard: Dashboard
  ) {
    return CRUD.replace(this.dashboardService, {...dashboard, _id: id}).catch(e => {
      throw new HttpException(e.message, e.status || 500);
    });
  }

  @Delete(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("dashboard:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", OBJECT_ID) id: ObjectId) {
    return CRUD.remove(this.dashboardService, id);
  }
}
