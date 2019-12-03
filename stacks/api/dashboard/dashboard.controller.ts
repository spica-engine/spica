import {Controller, Get, UseGuards, Param} from "@nestjs/common";
import {DashboardService} from "./dashboard.service";
import {ActionGuard, AuthGuard} from "@spica-server/passport";
@Controller("dashboard")
export class DashboardController {
  constructor(private ds: DashboardService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("dashboard:index"))
  index() {
    return this.ds.find();
  }

  @Get(":key")
  @UseGuards(AuthGuard(), ActionGuard("dashboard:index"))
  async show(@Param("key") key) {
   
    return this.ds.findOne(key);
  }
}
