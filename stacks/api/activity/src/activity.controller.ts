import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UseGuards
} from "@nestjs/common";
import {Activity, ActivityService, Resource} from "@spica-server/activity/services/src";
import {DATE, JSONP, NUMBER} from "@spica-server/core";
import {FilterQuery, ObjectId, OBJECT_ID, DatabaseService} from "@spica-server/database";
import {ActionGuard, AuthGuard} from "@spica-server/passport";

@Controller("activity")
export class ActivityController {
  constructor(private activityService: ActivityService, private database: DatabaseService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("activity:index"))
  find(
    @Query("identifier") identifier,
    @Query("action", JSONP) action: number | number[],
    @Query("resource", JSONP) resource: Resource,
    @Query("begin", DATE) begin: Date,
    @Query("end", DATE) end: Date,
    @Query("skip", NUMBER) skip: number,
    @Query("limit", NUMBER) limit: number
  ): Promise<Activity[]> {
    let aggregation: object[] = [
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
      },
      {
        $addFields: {
          date: {$toDate: "$_id"}
        }
      }
    ];

    let filter: FilterQuery<Activity> = {};

    if (identifier) filter.identifier = identifier;

    if (!isNaN(begin.getTime()) && !isNaN(end.getTime())) {
      filter._id = {
        $gte: ObjectId.createFromTime(begin.getTime() / 1000),
        $lt: ObjectId.createFromTime(end.getTime() / 1000)
      };
    }

    if (action) {
      if (Array.isArray(action) && action.length > 0) {
        filter["$or"] = action.map(val => {
          return {action: Number(val)};
        });
      } else if (!Array.isArray(action)) {
        filter["$or"] = [{action: Number(action)}];
      }
    }

    if (resource) {
      if (resource.name) {
        filter["resource.name"] = resource.name;
      }
      if (resource.documentId) {
        filter["resource.documentId"] = {
          $in: Array.isArray(resource.documentId) ? resource.documentId : [resource.documentId]
        };
      }
    }

    if (filter) aggregation.push({$match: filter});

    if (skip) aggregation.push({$skip: skip});

    if (limit) aggregation.push({$limit: limit});

    return this.activityService.aggregate(aggregation).toArray();
  }

  @Get("collection/:name")
  @UseGuards(AuthGuard(), ActionGuard("activity:index"))
  findCollection(@Param("name") name: string): Promise<string[]> {
    return this.database
      .collection(name)
      .find({})
      .map(document => document._id)
      .toArray();
  }

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("activity:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.activityService.deleteOne({_id: id});
  }

  @Delete()
  @UseGuards(AuthGuard(), ActionGuard("activity:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMany(@Body() ids: ObjectId[]) {
    return this.activityService.deleteMany({_id: {$in: ids.map(id => new ObjectId(id))}});
  }
}
