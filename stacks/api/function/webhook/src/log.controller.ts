import {WebhookLogService} from "./log.service";
import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  Delete,
  HttpStatus,
  Param,
  Body
} from "@nestjs/common";
import {AuthGuard} from "@spica-server/passport";
import {NUMBER, DATE, ARRAY, DEFAULT} from "@spica-server/core";
import {FilterQuery, ObjectId, OBJECT_ID} from "@spica-server/database";
import {Log} from ".";

@Controller("webhook/logs")
export class WebhookLogController {
  constructor(private logService: WebhookLogService) {}

  @Get()
  @UseGuards(AuthGuard())
  getLogs(
    @Query("webhook", DEFAULT([]), ARRAY(String)) webhook: string[],
    @Query("begin", DATE) begin: Date,
    @Query("end", DATE) end: Date,
    @Query("status", DEFAULT([]), ARRAY(Number)) status: number[],
    @Query("skip", NUMBER) skip: number,
    @Query("limit", NUMBER) limit: number
  ) {
    let aggregation: object[] = [
      {
        $addFields: {
          execution_time: {$toDate: "$_id"}
        }
      }
    ];

    let filter: FilterQuery<Log> = {};

    if (!isNaN(begin.getTime()) && !isNaN(end.getTime())) {
      filter._id = {
        $gte: ObjectId.createFromTime(begin.getTime() / 1000),
        $lt: ObjectId.createFromTime(end.getTime() / 1000)
      };
    }

    if (webhook.length) {
      filter.webhook = {$in: webhook};
    }

    if (status.length) {
      filter["response.status"] = {$in: status};
    }

    aggregation.push({$match: filter});

    if (skip) aggregation.push({$skip: skip});

    if (limit) aggregation.push({$limit: limit});

    return this.logService
      .aggregate(aggregation)
      .toArray()
      .catch(err => console.log(err));
  }

  @Delete(":id")
  @UseGuards(AuthGuard())
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.logService.deleteOne({_id: id});
  }

  @Delete()
  @UseGuards(AuthGuard())
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMany(@Body(DEFAULT([]), ARRAY(value => new ObjectId(value))) ids: ObjectId[]) {
    return this.logService.deleteMany({_id: {$in: ids}});
  }
}
