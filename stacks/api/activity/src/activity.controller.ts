import {Controller, Get, Query, Delete, HttpStatus, HttpCode, Param, Body} from "@nestjs/common";
import {Activity, Resource} from "./";
import {ActivityService} from "./activity.service";
import {JSONP, DATE, NUMBER} from "@spica-server/core";
import {ObjectId, OBJECT_ID, FilterQuery} from "@spica-server/database";

@Controller("activity")
export class ActivityController {
  constructor(private activityService: ActivityService) {}
  @Get()
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

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.activityService.deleteOne({_id: id});
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMany(@Body() ids: ObjectId[]) {
    return this.activityService.deleteMany({_id: {$in: ids.map(id => new ObjectId(id))}});
  }
}
