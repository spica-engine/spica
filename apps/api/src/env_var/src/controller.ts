import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
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

@Controller("env-var")
export class EnvVarsController {
  constructor(private envVarsService: EnvVarsService) {}

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
      await pipelineBuilder.paginate(
        paginate,
        seekingPipeline,
        this.envVarsService.estimatedDocumentCount()
      )
    ).result();

    if (paginate) {
      return this.envVarsService
        .aggregate<PaginationResponse<EnvVar>>(pipeline)
        .next()
        .then(r => {
          if (!r.data.length) {
            r.meta = {total: 0};
          }
          return r;
        });
    }

    return this.envVarsService.aggregate<EnvVar[]>([...pipeline, ...seekingPipeline]).toArray();
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("env-var:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.envVarsService.findOne({_id: id});
  }

  @Post()
  @UseGuards(AuthGuard(), ActionGuard("env-var:create"))
  async insertOne(
    @Body(Schema.validate("http://spica.internal/env_var"))
    envVar: EnvVar
  ) {
    return this.envVarsService.insertOne(envVar).catch(exception => {
      throw new BadRequestException(exception.message);
    });
  }

  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("env-var:update"))
  async updateOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/env_var"))
    envVar: Partial<EnvVar>
  ) {
    return this.envVarsService
      .findOneAndUpdate({_id: id}, {$set: envVar}, {returnDocument: ReturnDocument.AFTER})
      .catch(exception => {
        throw new BadRequestException(exception.message);
      });
  }

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("env-var:delete"))
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    const envVar = await this.envVarsService.findOne({_id: id});

    if (!envVar) {
      throw new NotFoundException();
    }

    return this.envVarsService.deleteOne({_id: id});
  }
}
