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
import {SecretService} from "@spica-server/secret-services";
import {Schema} from "@spica-server/core-schema";
import {AuthGuard, ActionGuard, ResourceFilter} from "@spica-server/passport-guard";
import {activity} from "@spica-server/activity-services";
import {createSecretActivity} from "./activity.resource.js";
import * as CRUD from "./crud.js";
import {ID} from "@spica-server/data";
import {COLLECTION_QUERY, CollectionQueryFacade, Id} from "@spica-server/interface-data";

@Controller("secret")
export class SecretController {
  constructor(
    private ss: SecretService,
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade
  ) {}

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("secret:index"))
  async find(
    @ResourceFilter({collection: "secret"}) resourceFilter: object,
    @Query("limit", DEFAULT(0), NUMBER) limit: number,
    @Query("skip", DEFAULT(0), NUMBER) skip: number,
    @Query("sort", JSONP) sort: {[path: string]: 1 | -1},
    @Query("paginate", DEFAULT(false), BOOLEAN) paginate: boolean,
    @Query("filter", JSONP) filter: object
  ) {
    return CRUD.find(this.queries, {resourceFilter, limit, skip, sort, paginate, filter});
  }

  @Get(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("secret:show"))
  findOne(@Param("id", ID("secret")) id: Id) {
    return CRUD.findOne(this.queries, id);
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
    @Param("id", ID("secret")) id: Id,
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
  async deleteOne(@Param("id", ID("secret")) id: Id) {
    return CRUD.remove(this.ss, id);
  }
}
