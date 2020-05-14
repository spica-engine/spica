import {
  Controller,
  Get,
  UseGuards,
  Param,
  Body,
  Put,
  Delete,
  HttpCode,
  HttpStatus
} from "@nestjs/common";
import {ActionGuard, AuthGuard} from "@spica-server/passport";
import {DashboardService} from "./dashboard.service";
import {Dashboard} from "./dashboard";
import {Schema} from "@spica-server/core/schema";

@Controller("dashboard")
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("dashboard:index"))
  findAll() {
    return this.dashboardService.findAll();
  }

  @Get(":key")
  @UseGuards(AuthGuard(), ActionGuard("dashboard:show"))
  find(@Param("key") key: string) {
    return this.dashboardService.find(key);
  }

  @Put()
  @UseGuards(AuthGuard(), ActionGuard("dashboard:update"))
  register(
    @Body(Schema.validate("http://spica.internal/dashboard"))
    dashboard: Dashboard
  ) {
    return this.dashboardService.register(dashboard);
  }

  @Delete(":key")
  @UseGuards(AuthGuard(), ActionGuard("dashboard:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  unregister(@Param("key") key: string) {
    return this.dashboardService.unregister(key);
  }
}
