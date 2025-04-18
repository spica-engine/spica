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

@Controller("activity")
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("activity:index"))
  find(
    @Query("identifier") identifier,
    @Query("action", DEFAULT([]), ARRAY(Number)) action: number[],
    @Query("resource", JSONP) resource: object,
    @Query("begin", DATE) begin: Date,
    @Query("end", DATE) end: Date,
    @Query("skip", NUMBER) skip: number,
    @Query("limit", NUMBER) limit: number
  ) {
    const aggregation: object[] = [
      {
        $lookup: {
          from: "identity",
          localField: "identifier",
          foreignField: "_id",
          as: "identifier"
        }
      },
      {$unwind: "$identifier"},
      {
        $set: {
          identifier: "$identifier.identifier"
        }
      }
    ];

    let filter: Filter<Activity> = {};

    if (identifier) {
      filter.identifier = identifier;
    }

    if (!isNaN(begin.getTime()) && !isNaN(end.getTime())) {
      filter._id = {
        $gte: ObjectId.createFromTime(begin.getTime() / 1000),
        $lt: ObjectId.createFromTime(end.getTime() / 1000)
      };
    }

    if (action.length > 0) {
      filter["$or"] = action.map(act => {
        return {action: act};
      });
    }

    if (resource) {
      filter = {...filter, resource};
    }

    if (filter) {
      aggregation.push({$match: filter});
    }

    aggregation.push({$sort: {_id: -1}});

    if (skip) {
      aggregation.push({$skip: skip});
    }

    if (limit) {
      aggregation.push({$limit: limit});
    }

    return this.activityService.aggregate(aggregation).toArray();
  }

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("activity:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", OBJECT_ID) id: ObjectId) {
    const deletedCount = await this.activityService.deleteOne({_id: id});
    if (!deletedCount) {
      throw new NotFoundException(`Activity with ID ${id} not found`);
    }
  }

  @Delete()
  @UseGuards(AuthGuard(), ActionGuard("activity:delete"))
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
