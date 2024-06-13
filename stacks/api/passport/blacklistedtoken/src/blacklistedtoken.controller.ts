import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { BOOLEAN, DEFAULT, JSONP, NUMBER } from "@spica-server/core";
import { Schema } from "@spica-server/core/schema";
import { ObjectId, OBJECT_ID } from "@spica-server/database";
import { ActionGuard, AuthGuard, ResourceFilter } from "@spica-server/passport/guard";
import { BlacklistedTokenService } from "./blacklistedtoken.service";
import { BlacklistedToken, PaginationResponse } from "./interface";
import { PipelineBuilder } from "@spica-server/database/pipeline";
import { Cron, CronExpression } from '@nestjs/schedule';
import { BLACKLISTEDTOKEN_OPTIONS, BlacklistedTokenOptions } from "./options";

@Controller("passport/blacklistedtoken")
export class BlacklistedTokenController {
  constructor(
    private blacklistedTokenService: BlacklistedTokenService,
    @Inject(BLACKLISTEDTOKEN_OPTIONS) private options: BlacklistedTokenOptions,
    ) { }

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("passport:blacklistedtoken:index"))
  async find(
    @Query("limit", DEFAULT(0), NUMBER) limit: number,
    @Query("skip", DEFAULT(0), NUMBER) skip: number,
    @Query("sort", JSONP) sort: object,
    @Query("paginate", DEFAULT(false), BOOLEAN) paginate: boolean,
    @Query("filter", JSONP) filter: object,
    @ResourceFilter() resourceFilter: object
  ) {
    const pipelineBuilder = await new PipelineBuilder()
    .filterResources(resourceFilter)
    .filterByUserRequest(filter);

    const seekingPipeline = new PipelineBuilder()
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .result();

    const pipeline = (await pipelineBuilder.paginate(
      paginate,
      seekingPipeline,
      this.blacklistedTokenService.estimatedDocumentCount()
    )).result();

    if (paginate) {
      return this.blacklistedTokenService
        .aggregate<PaginationResponse<BlacklistedToken>>(pipeline)
        .next()
        .then(r => {
          if (!r.data.length) {
            r.meta = {total: 0};
          }
          return r;
        });
    }


    return this.blacklistedTokenService.aggregate<BlacklistedToken[]>([...pipeline, ...seekingPipeline]).toArray();
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:blacklistedtoken:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.blacklistedTokenService.findOne({_id: id}).then(r => {
      if (!r) {
        throw new NotFoundException();
      }
      return r;
    });
  }

  @Post()
  @UseGuards(AuthGuard(), ActionGuard("passport:blacklistedtoken:create"))
  insertOne(@Body(Schema.validate("http://spica.internal/passport/blacklistedtoken")) jwt: BlacklistedToken) {
    jwt.expires_in = jwt.expires_in ? new Date(jwt.expires_in) : new Date();
    return this.blacklistedTokenService.insertOne(jwt);
  }

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:blacklistedtoken:delete"))
  deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.blacklistedTokenService.deleteOne({_id: id}).then(r => {
      if (!r) {
        throw new NotFoundException();
      }
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  clearExpiredTokes() {
    const now = new Date();
    const expiresIn = new Date(now.getTime() - this.options.refreshTokenExpiresIn * 1000);
    this.blacklistedTokenService.deleteMany({expires_in: { $lt: expiresIn }})
  }
}
