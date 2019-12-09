import {Controller, Get, UseGuards} from "@nestjs/common";
import {ActionGuard, AuthGuard} from "@spica-server/passport";
import {DashboardService} from "./dashboard.service";
@Controller("dashboard")
export class DashboardController {
  constructor(private ds: DashboardService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("dashboard:index"))
  findAll() {
    return this.ds.find();
  }
}
