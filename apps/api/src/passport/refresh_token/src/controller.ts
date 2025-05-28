import {
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  UseGuards
} from "@nestjs/common";
import {BOOLEAN, DEFAULT, JSONP, NUMBER} from "@spica-server/core";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import {RefreshTokenService} from "@spica-server/passport/refresh_token/services";
import {RefreshToken, PaginationResponse} from "@spica-server/interface/passport/refresh_token";
import {PipelineBuilder} from "@spica-server/database/pipeline";
import {REFRESH_TOKEN_OPTIONS, RefreshTokenOptions} from "./options";

@Controller("passport/refreshtoken")
export class RefreshTokenController {
  constructor(
    private service: RefreshTokenService,
    @Inject(REFRESH_TOKEN_OPTIONS) private options: RefreshTokenOptions
  ) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("passport:refreshtoken:index"))
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

    const seekingPipeline = new PipelineBuilder().sort(sort).skip(skip).limit(limit).result();

    const pipeline = (
      await pipelineBuilder.paginate(
        paginate,
        seekingPipeline,
        this.service.estimatedDocumentCount()
      )
    ).result();

    if (paginate) {
      return this.service
        .aggregate<PaginationResponse<RefreshToken>>(pipeline)
        .next()
        .then(r => {
          if (!r.data.length) {
            r.meta = {total: 0};
          }
          return r;
        });
    }

    return this.service.aggregate<RefreshToken[]>([...pipeline, ...seekingPipeline]).toArray();
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:refreshtoken:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.service.findOne({_id: id}).then(r => {
      if (!r) {
        throw new NotFoundException();
      }
      return r;
    });
  }

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:refreshtoken:delete"))
  deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.service.deleteOne({_id: id}).then(r => {
      if (!r) {
        throw new NotFoundException();
      }
    });
  }
}
