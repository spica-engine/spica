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
import {ARRAY, DATE, DEFAULT, JSONP, NUMBER} from "@spica-server/core";
import {Filter, ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard} from "@spica-server/passport/guard";
import {Log} from "@spica-server/interface/function/webhook";
import {WebhookLogService} from "./log.service";

@Controller("webhook/logs")
export class WebhookLogController {
  constructor(private logService: WebhookLogService) {}

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("webhook:logs:index"))
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
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("webhook:logs:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", OBJECT_ID) id: ObjectId) {
    const deletedCount = await this.logService.deleteOne({_id: id});
    if (!deletedCount) {
      throw new NotFoundException(`Log with ID ${id} not found`);
    }
  }

  @Delete()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("webhook:logs:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMany(@Body(DEFAULT([]), ARRAY(value => new ObjectId(value))) ids: ObjectId[]) {
    const deletedCount = await this.logService.deleteMany({_id: {$in: ids}});
    if (!deletedCount) {
      throw new NotFoundException("No logs found with the provided IDs");
    }
  }
}
