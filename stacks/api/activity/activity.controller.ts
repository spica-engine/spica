import {Controller, Get, Query} from "@nestjs/common";
import {ActivityService} from "./activity.service";
import {Activity, Resource} from ".";
import {JSONP, DATE} from "@spica-server/core";
import {ObjectID} from "mongodb";

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
        $gte: ObjectID.createFromTime(begin.getTime() / 1000),
        $lt: ObjectID.createFromTime(end.getTime() / 1000)
      };
    }

    if (action) {
      filter["action"] = action;
    }

    // if (resource) {
    //   if (resource.moduleName) {
    //     filter["resource.moduleName"] = resource.moduleName;
    //   }
    //   if (resource.moduleId) {
    //     filter["resource.moduleId"] = resource.moduleId;
    //   }
    //   if (resource.documentId) {
    //     filter["resource.documentId"] = resource.documentId;
    //   }
    // }

    console.log(filter)

    return this.activityService.find(filter);
  }
}
