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
  UseInterceptors
} from "@nestjs/common";
import {BOOLEAN, DEFAULT, NUMBER, JSONP} from "@spica-server/core";
import {EnvVarService} from "@spica-server/env_var/services";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {Schema} from "@spica-server/core/schema";
import {AuthGuard, ActionGuard, ResourceFilter} from "@spica-server/passport/guard";
import {EnvVar} from "@spica-server/interface/env_var";
import * as CRUD from "./crud";
import {activity} from "@spica-server/activity/services";
import {createEnvVarActivity} from "./activity.resource";

@Controller("env-var")
export class EnvVarController {
  constructor(private evs: EnvVarService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("env-var:index"))
  async find(
    @ResourceFilter() resourceFilter: object,
    @Query("limit", DEFAULT(0), NUMBER) limit: number,
    @Query("skip", DEFAULT(0), NUMBER) skip: number,
    @Query("sort", JSONP) sort: object,
    @Query("paginate", DEFAULT(false), BOOLEAN) paginate: boolean,
    @Query("filter", JSONP) filter: object
  ) {
    return CRUD.find(this.evs, {resourceFilter, limit, skip, sort, paginate, filter});
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("env-var:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return CRUD.findOne(this.evs, id);
  }

  @UseInterceptors(activity(createEnvVarActivity))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("env-var:create"))
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
  @UseGuards(AuthGuard(), ActionGuard("env-var:update"))
  async updateOne(
    @Param("id", OBJECT_ID) id: ObjectId,
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
  @UseGuards(AuthGuard(), ActionGuard("env-var:delete"))
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return CRUD.remove(this.evs, id);
  }
}
