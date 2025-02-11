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
import {ARRAY, DATE, DEFAULT, JSONP, NUMBER} from "@spica-server/core";
import {Filter, ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard} from "@spica-server/passport/guard";
import {Log} from "./interface";
import {WebhookLogService} from "./log.service";

@Controller("webhook/logs")
export class WebhookLogController {
  constructor(private logService: WebhookLogService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("webhook:logs:index"))
  getLogs(
    @Query("webhook", DEFAULT([]), ARRAY(String)) webhook: string[],
    @Query("begin", DATE) begin: Date,
    @Query("end", DATE) end: Date,
    @Query("succeed", JSONP) succeed: boolean,
    @Query("skip", NUMBER) skip: number,
    @Query("limit", NUMBER) limit: number
  ) {
    let filter: Filter<Log> = {};

    if (!isNaN(begin.getTime()) && !isNaN(end.getTime())) {
      filter._id = {
        $gte: ObjectId.createFromTime(begin.getTime() / 1000),
        $lt: ObjectId.createFromTime(end.getTime() / 1000)
      };
    }

    if (webhook.length) {
      filter.webhook = {$in: webhook};
    }

    if (succeed != null) {
      filter.succeed = {$eq: succeed};
    }

    const aggregation: object[] = [{$match: filter}];

    aggregation.push({$sort: {_id: -1}});

    if (skip) {
      aggregation.push({$skip: skip});
    }

    if (limit) {
      aggregation.push({$limit: limit});
    }

    return this.logService.aggregate(aggregation).toArray();
  }

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("webhook:logs:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.logService.deleteOne({_id: id});
  }

  @Delete()
  @UseGuards(AuthGuard(), ActionGuard("webhook:logs:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMany(@Body(DEFAULT([]), ARRAY(value => new ObjectId(value))) ids: ObjectId[]) {
    return this.logService.deleteMany({_id: {$in: ids}});
  }
}
