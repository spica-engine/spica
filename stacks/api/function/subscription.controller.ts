import {ActionGuard, AuthGuard} from "@spica-server/passport";
import {Body, Controller, Delete, Get, Param, Post, UseGuards, Query} from "@nestjs/common";
import {SubscriptionService} from "./subscription.service";
import {NUMBER} from "@spica-server/core";
import {OBJECT_ID, ObjectId} from "@spica-server/database";

@Controller("subscription")
export class SubscriptionController {
  constructor(private ss: SubscriptionService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("subscription:index"))
  find(@Query("limit", NUMBER) limit: number = 100, @Query("skip", NUMBER) skip: number = 0) {
    const aggregate = [
      {
        $facet: {
          meta: [{$count: "total"}],
          data: [{$skip: skip}, {$limit: limit}]
        }
      },
      {
        $project: {
          meta: {$arrayElemAt: ["$meta", 0]},
          data: "$data"
        }
      }
    ];
    return this.ss
      .find(aggregate)
      .then(result => (result && result[0]) || Promise.reject("Cannot found."));
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("subscription:show"))
  show(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.ss.findOne(id);
  }

  @Post("add")
  @UseGuards(AuthGuard(), ActionGuard("subscription:update"))
  add(@Body() body: any) {
    return this.ss.upsertOne(body);
  }

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("subscription:delete"))
  async delete(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.ss.deleteOne(id);
  }
}
