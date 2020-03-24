import {Controller, Get, Query, Delete, HttpStatus, HttpCode, Param} from "@nestjs/common";
import {ActivityService} from "./activity.service";
import {Activity, Resource} from ".";
import {JSONP, DATE} from "@spica-server/core";
import {ObjectId, OBJECT_ID} from "@spica-server/database";

@Controller("activity")
export class ActivityController {
  constructor(private activityService: ActivityService) {}
  @Get()
  find(
    @Query("identifier") identifier = "",
    @Query("action") action: string,
    @Query("resource", JSONP) resource: Resource,
    @Query("begin", DATE) begin: Date,
    @Query("end", DATE) end: Date
  ): Promise<Activity[]> {
    let filter = {
      identifier: {
        $regex: `^${identifier}`
      }
    };

    if (!isNaN(begin.getTime()) && !isNaN(end.getTime())) {
      filter["_id"] = {
        $gte: ObjectId.createFromTime(begin.getTime() / 1000),
        $lt: ObjectId.createFromTime(end.getTime() / 1000)
      };
    }

    if (action) {
      filter["action"] = action;
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
    return this.activityService.find(filter);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.activityService.deleteOne({_id: id});
  }
}
