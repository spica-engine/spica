import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
  UseGuards
} from "@nestjs/common";
import {BOOLEAN, DEFAULT, JSONP, NUMBER} from "../../../../../../libs/core";
import {ObjectId, OBJECT_ID} from "../../../../../../libs/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "../../guard";
import {RefreshTokenService} from "../services";
import {RefreshToken, PaginationResponse} from "../../../../../../libs/interface/passport/refresh_token";
import {PipelineBuilder} from "../../../../../../libs/database/pipeline";

@Controller("passport/refresh-token")
export class RefreshTokenController {
  constructor(private service: RefreshTokenService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("passport:refresh-token:index"))
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
  @UseGuards(AuthGuard(), ActionGuard("passport:refresh-token:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.service.findOne({_id: id}).then(r => {
      if (!r) {
        throw new NotFoundException();
      }
      return r;
    });
  }

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:refresh-token:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.service.deleteOne({_id: id}).then(r => {
      if (!r) {
        throw new NotFoundException();
      }
    });
  }
}
