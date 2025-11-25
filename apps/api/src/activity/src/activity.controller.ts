import {
  Body,
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
import {ActivityService} from "@spica-server/activity/services";
import {DATE, JSONP, NUMBER, DEFAULT, ARRAY} from "@spica-server/core";
import {Filter, ObjectId, OBJECT_ID} from "@spica-server/database";
import {Activity} from "@spica-server/interface/activity";
import {ActionGuard, AuthGuard} from "@spica-server/passport/guard";
import {ActivityPipelineBuilder} from "./pipeline.builder";

@Controller("activity")
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("activity:index"))
  async find(
    @Query("identifier") identifier: string,
    @Query("username") username: string,
    @Query("action", DEFAULT([]), ARRAY(Number)) action: number[],
    @Query("resource", JSONP) resource: object,
    @Query("begin", DATE) begin: Date,
    @Query("end", DATE) end: Date,
    @Query("skip", NUMBER) skip: number,
    @Query("limit", NUMBER) limit: number
  ) {
    const builder = await new ActivityPipelineBuilder().resolveRelations().filterByUserRequest({
      action,
      identifier,
      username,
      resource,
      begin,
      end
    });

    builder.sort({_id: -1}).skip(skip).limit(limit);

    return this.activityService.aggregate(builder.result()).toArray();
  }

  @Delete(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("activity:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", OBJECT_ID) id: ObjectId) {
    const deletedCount = await this.activityService.deleteOne({_id: id});
    if (!deletedCount) {
      throw new NotFoundException(`Activity with ID ${id} not found`);
    }
  }

  @Delete()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("activity:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMany(@Body() ids: ObjectId[]) {
    const deletedCount = await this.activityService.deleteMany({
      _id: {$in: ids.map(id => new ObjectId(id))}
    });
    if (!deletedCount) {
      throw new NotFoundException("No activities found with the provided IDs");
    }
  }
}
