import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Query,
  UseGuards
} from "@nestjs/common";
import {ARRAY, DATE, DEFAULT, JSONP, NUMBER} from "@spica-server/core";
import {ID, ids} from "@spica-server/data";
import {COLLECTION_QUERY, CollectionQueryFacade, Id, ReadSpec} from "@spica-server/interface-data";
import {ActionGuard, AuthGuard} from "@spica-server/passport-guard";
import {WebhookLogService} from "./log.service.js";

const logIds = () => ids().forCollection("webhook_logs");

@Controller("webhook/logs")
export class WebhookLogController {
  constructor(
    private logService: WebhookLogService,
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade
  ) {}

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
    const where: ReadSpec["where"] = {};

    if (webhook.length) {
      where.webhook = {in: webhook};
    }

    if (succeed != null) {
      where.succeed = {eq: succeed};
    }

    const hasRange = !isNaN(begin.getTime()) && !isNaN(end.getTime());

    return this.queries.find("webhook_logs", {
      createdBetween: hasRange ? {from: begin, to: end} : undefined,
      where,
      sort: {_id: -1},
      skip,
      limit
    });
  }

  @Delete(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("webhook:logs:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", ID("webhook_logs")) id: Id) {
    const deletedCount = await this.logService.deleteOne({_id: id});
    if (!deletedCount) {
      throw new NotFoundException(`Log with ID ${id} not found`);
    }
  }

  @Delete()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("webhook:logs:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMany(@Body(DEFAULT([]), ARRAY(value => logIds().parse(value))) ids: Id[]) {
    const deletedCount = await this.logService.deleteMany({_id: {$in: ids}});
    if (!deletedCount) {
      throw new NotFoundException("No logs found with the provided IDs");
    }
  }
}
