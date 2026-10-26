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
  HttpException,
  Inject
} from "@nestjs/common";
import {ActionGuard, AuthGuard} from "@spica-server/passport-guard";
import {DashboardService} from "./dashboard.service.js";
import {Dashboard} from "@spica-server/interface-dashboard";
import {Schema} from "@spica-server/core-schema";
import {ResourceFilter} from "@spica-server/passport-guard";
import * as CRUD from "./crud.js";
import {ID} from "@spica-server/data";
import {COLLECTION_QUERY, CollectionQueryFacade, Id} from "@spica-server/interface-data";

@Controller("dashboard")
export class DashboardController {
  constructor(
    private dashboardService: DashboardService,
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade
  ) {}

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("dashboard:index"))
  findAll(@ResourceFilter({collection: "dashboard"}) resourceFilter: object) {
    return CRUD.find(this.queries, resourceFilter);
  }

  @Get(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("dashboard:show"))
  findById(@Param("id", ID("dashboard")) id: Id) {
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
    @Param("id", ID("dashboard")) id: Id,
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
  async delete(@Param("id", ID("dashboard")) id: Id) {
    await CRUD.remove(this.dashboardService, id).catch(e => {
      throw new HttpException(e.message, e.status || 500);
    });
  }
}
