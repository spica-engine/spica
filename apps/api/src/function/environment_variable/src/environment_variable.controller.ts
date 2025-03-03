import {Controller, Get, Query} from "@nestjs/common";
import {BOOLEAN, DEFAULT, NUMBER, JSONP} from "@spica-server/core";
import {PipelineBuilder} from "@spica-server/database/pipeline";
import {PaginationResponse} from "@spica-server/passport/identity";
import {EnvironmentVariableService} from "./environment_variabe.service";
import {EnvironmentVariable} from "./interface";

@Controller("function-env")
export class EnvironmentVariableController {
  constructor(private environmentService: EnvironmentVariableService) {}

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
        this.environmentService.estimatedDocumentCount()
      )
    ).result();

    if (paginate) {
      return this.environmentService
        .aggregate<PaginationResponse<EnvironmentVariable>>(pipeline)
        .next()
        .then(r => {
          if (!r.data.length) {
            r.meta = {total: 0};
          }
          return r;
        });
    }

    return this.environmentService.aggregate<EnvironmentVariable[]>(seekingPipeline).toArray();
  }
}
