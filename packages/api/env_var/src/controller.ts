import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  Inject
} from "@nestjs/common";
import {BOOLEAN, DEFAULT, NUMBER, JSONP} from "@spica-server/core";
import {PaginationResponse} from "@spica-server/interface-passport-identity";
import {EnvVarService} from "@spica-server/env_var-services";
import {Schema} from "@spica-server/core-schema";
import {AuthGuard, ActionGuard, ResourceFilter} from "@spica-server/passport-guard";
import {EnvVar} from "@spica-server/interface-env_var";
import * as CRUD from "./crud.js";
import {activity} from "@spica-server/activity-services";
import {createEnvVarActivity} from "./activity.resource.js";
import {ID} from "@spica-server/data";
import {COLLECTION_QUERY, CollectionQueryFacade, Id} from "@spica-server/interface-data";

const ENV_VAR_COLLECTION = "env_var";

@Controller("env-var")
export class EnvVarController {
  constructor(
    private evs: EnvVarService,
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade
  ) {}

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("env-var:index"))
  async find(
    @ResourceFilter({collection: ENV_VAR_COLLECTION}) resourceFilter: object,
    @Query("limit", DEFAULT(0), NUMBER) limit: number,
    @Query("skip", DEFAULT(0), NUMBER) skip: number,
    @Query("sort", JSONP) sort: {[path: string]: 1 | -1},
    @Query("paginate", DEFAULT(false), BOOLEAN) paginate: boolean,
    @Query("filter", JSONP) filter: object
  ) {
    return CRUD.find(this.queries, {resourceFilter, limit, skip, sort, paginate, filter});
  }

  @Get(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("env-var:show"))
  findOne(@Param("id", ID(ENV_VAR_COLLECTION)) id: Id) {
    return CRUD.findOne(this.evs, id);
  }

  @UseInterceptors(activity(createEnvVarActivity))
  @Post()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("env-var:create"))
  async insertOne(
    @Body(Schema.validate("http://spica.internal/env_var"))
    envVar: EnvVar
  ) {
    return CRUD.insert(this.evs, envVar).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });
  }

  @UseInterceptors(activity(createEnvVarActivity))
  @Put(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("env-var:update"))
  async updateOne(
    @Param("id", ID(ENV_VAR_COLLECTION)) id: Id,
    @Body(Schema.validate("http://spica.internal/env_var"))
    envVar: EnvVar
  ) {
    return CRUD.replace(this.evs, {...envVar, _id: id}).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });
  }

  @UseInterceptors(activity(createEnvVarActivity))
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("env-var:delete"))
  async deleteOne(@Param("id", ID(ENV_VAR_COLLECTION)) id: Id) {
    return CRUD.remove(this.evs, id);
  }
}
