import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Put,
  Query,
  UseGuards
} from "@nestjs/common";
import {BOOLEAN, DEFAULT, NUMBER, JSONP} from "@spica-server/core";
import {PipelineBuilder} from "@spica-server/database/pipeline";
import {PaginationResponse} from "@spica-server/passport/identity";
import {EnvVarsService} from "@spica-server/env_var/services";
import {ObjectId, OBJECT_ID, ReturnDocument} from "@spica-server/database";
import {Schema} from "@spica-server/core/schema";
import {AuthGuard, ActionGuard, ResourceFilter} from "@spica-server/passport/guard";
import {EnvVar} from "@spica-server/interface/env_var";
import * as CRUD from "./crud";

@Controller("env-var")
export class EnvVarsController {
  constructor(private evs: EnvVarsService) {}

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
    let pipelineBuilder = new PipelineBuilder().filterResources(resourceFilter);

    pipelineBuilder = await pipelineBuilder.filterByUserRequest(filter);

    const seekingPipeline = new PipelineBuilder().sort(sort).skip(skip).limit(limit).result();

    const pipeline = (
      await pipelineBuilder.paginate(paginate, seekingPipeline, this.evs.estimatedDocumentCount())
    ).result();

    if (paginate) {
      return this.evs
        .aggregate<PaginationResponse<EnvVar>>(pipeline)
        .next()
        .then(r => {
          if (!r.data.length) {
            r.meta = {total: 0};
          }
          return r;
        });
    }

    return this.evs.aggregate<EnvVar[]>([...pipeline, ...seekingPipeline]).toArray();
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("env-var:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.evs.findOne({_id: id});
  }

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

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("env-var:delete"))
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return CRUD.remove(this.evs, id);
  }
}
