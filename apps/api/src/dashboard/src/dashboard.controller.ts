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
  BadRequestException,
  NotFoundException
} from "@nestjs/common";
import {ActionGuard, AuthGuard} from "@spica-server/passport/guard";
import {DashboardService} from "./dashboard.service";
import {Dashboard} from "@spica-server/interface/dashboard";
import {Schema} from "@spica-server/core/schema";
import {ResourceFilter} from "@spica-server/passport/guard";
import {OBJECT_ID, ObjectId, ReturnDocument} from "@spica-server/database";

@Controller("dashboard")
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("dashboard:index"))
  findAll(@ResourceFilter() resourceFilter: object) {
    return this.dashboardService.aggregate([resourceFilter]).toArray();
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("dashboard:show"))
  findById(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.dashboardService.findOne({_id: id});
  }

  @Post()
  @UseGuards(AuthGuard(), ActionGuard("dashboard:create"))
  insert(@Body(Schema.validate("http://spica.internal/dashboard")) dashboard: Dashboard) {
    return this.dashboardService.insertOne(dashboard).catch(e => {
      throw new BadRequestException(e.message);
    });
  }

  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("dashboard:update"))
  async update(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/dashboard"))
    dashboard: Dashboard
  ) {
    const res = await this.dashboardService.findOneAndReplace({_id: id}, dashboard, {
      returnDocument: ReturnDocument.AFTER
    });
    if (!res) {
      throw new NotFoundException(`Dashboard with ID ${id} not found`);
    }
    return res;
  }

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("dashboard:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", OBJECT_ID) id: ObjectId) {
    const deletedCount = await this.dashboardService.deleteOne({_id: id});
    if (!deletedCount) {
      throw new NotFoundException(`Dashboard with ID ${id} not found`);
    }
  }
}
