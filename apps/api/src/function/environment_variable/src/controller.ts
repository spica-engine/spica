import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  HttpStatus,
  HttpCode,
  Headers,
  Inject,
  UnauthorizedException,
  InternalServerErrorException,
  Optional
} from "@nestjs/common";
import {BOOLEAN, DEFAULT, NUMBER, JSONP} from "@spica-server/core";
import {PipelineBuilder} from "@spica-server/database/pipeline";
import {PaginationResponse} from "@spica-server/passport/identity";
import {EnvironmentVariableService} from "./service";
import {EnvironmentVariable} from "./interface";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {Schema} from "@spica-server/core/schema";

@Controller("function-env")
export class EnvironmentVariableController {
  constructor(private environmentVariableService: EnvironmentVariableService) {}

  @Get()
  async find(
    @Query("limit", DEFAULT(0), NUMBER) limit: number,
    @Query("skip", DEFAULT(0), NUMBER) skip: number,
    @Query("sort", JSONP) sort: object,
    @Query("paginate", DEFAULT(false), BOOLEAN) paginate: boolean,
    @Query("filter", JSONP) filter: object
  ) {
    const pipelineBuilder = await new PipelineBuilder().filterByUserRequest(filter);

    const seekingPipeline = new PipelineBuilder().sort(sort).skip(skip).limit(limit).result();

    const pipeline = (
      await pipelineBuilder.paginate(
        paginate,
        seekingPipeline,
        this.environmentVariableService.estimatedDocumentCount()
      )
    ).result();

    if (paginate) {
      return this.environmentVariableService
        .aggregate<PaginationResponse<EnvironmentVariable>>(pipeline)
        .next()
        .then(r => {
          if (!r.data.length) {
            r.meta = {total: 0};
          }
          return r;
        });
    }

    return this.environmentVariableService
      .aggregate<EnvironmentVariable[]>(seekingPipeline)
      .toArray();
  }

  @Get(":id")
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.environmentVariableService.findOne({_id: id});
  }

  @Post()
  async insertOne(
    @Body(Schema.validate("http://spica.internal/function/environment_variable"))
    environmentVariable: EnvironmentVariable
  ) {
    return this.environmentVariableService.insertOne(environmentVariable).catch(exception => {
      throw new BadRequestException(exception.message);
    });
  }
}
