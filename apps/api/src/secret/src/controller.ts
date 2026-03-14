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
import {SecretService} from "@spica-server/secret/services";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {Schema} from "@spica-server/core/schema";
import {AuthGuard, ActionGuard, ResourceFilter} from "@spica-server/passport/guard";
import {activity} from "@spica-server/activity/services";
import {createSecretActivity} from "./activity.resource";
import * as CRUD from "./crud";

@Controller("secret")
export class SecretController {
  constructor(private ss: SecretService) {}

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("secret:index"))
  async find(
    @ResourceFilter() resourceFilter: object,
    @Query("limit", DEFAULT(0), NUMBER) limit: number,
    @Query("skip", DEFAULT(0), NUMBER) skip: number,
    @Query("sort", JSONP) sort: object,
    @Query("paginate", DEFAULT(false), BOOLEAN) paginate: boolean,
    @Query("filter", JSONP) filter: object
  ) {
    return CRUD.find(this.ss, {resourceFilter, limit, skip, sort, paginate, filter});
  }

  @Get(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("secret:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return CRUD.findOne(this.ss, id);
  }

  @UseInterceptors(activity(createSecretActivity))
  @Post()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("secret:create"))
  async insertOne(
    @Body(Schema.validate("http://spica.internal/secret"))
    body: {
      key: string;
      value: string;
    }
  ) {
    return CRUD.insert(this.ss, body).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });
  }

  @UseInterceptors(activity(createSecretActivity))
  @Put(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("secret:update"))
  async updateOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/secret"))
    body: {key: string; value: string}
  ) {
    return CRUD.replace(this.ss, id, body).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });
  }

  @UseInterceptors(activity(createSecretActivity))
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("secret:delete"))
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return CRUD.remove(this.ss, id);
  }
}
