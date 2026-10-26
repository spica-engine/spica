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
import {
  Dashboard,
  DASHBOARD_REPOSITORY,
  DashboardRepository
} from "@spica-server/interface-dashboard";
import {Schema} from "@spica-server/core-schema";
import {ResourceFilter} from "@spica-server/passport-guard";
import * as CRUD from "./crud.js";
import {ID} from "@spica-server/data";
import {COLLECTION_QUERY, CollectionQueryFacade, Id} from "@spica-server/interface-data";

const DASHBOARD_COLLECTION = "dashboard";

@Controller("dashboard")
export class DashboardController {
  constructor(
    @Inject(DASHBOARD_REPOSITORY) private dashboards: DashboardRepository,
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade
  ) {}

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("dashboard:index"))
  findAll(@ResourceFilter({collection: DASHBOARD_COLLECTION}) resourceFilter: object) {
    return CRUD.find(this.queries, resourceFilter);
  }

  @Get(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("dashboard:show"))
  findById(@Param("id", ID(DASHBOARD_COLLECTION)) id: Id) {
    return CRUD.findOne(this.dashboards, id);
  }

  @Post()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("dashboard:create"))
  insert(@Body(Schema.validate("http://spica.internal/dashboard")) dashboard: Dashboard) {
    return CRUD.insert(this.dashboards, dashboard).catch(e => {
      throw new HttpException(e.message, e.status || 500);
    });
  }

  @Put(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("dashboard:update"))
  async update(
    @Param("id", ID(DASHBOARD_COLLECTION)) id: Id,
    @Body(Schema.validate("http://spica.internal/dashboard"))
    dashboard: Dashboard
  ) {
    return CRUD.replace(this.dashboards, {...dashboard, _id: id}).catch(e => {
      throw new HttpException(e.message, e.status || 500);
    });
  }

  @Delete(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("dashboard:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", ID(DASHBOARD_COLLECTION)) id: Id) {
    await CRUD.remove(this.dashboards, id).catch(e => {
      throw new HttpException(e.message, e.status || 500);
    });
  }
}
