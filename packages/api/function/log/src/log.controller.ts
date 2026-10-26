import {
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
import {ARRAY, DATE, DEFAULT, NUMBER} from "@spica-server/core";
import {COLLECTION_QUERY, CollectionQueryFacade, ReadSpec} from "@spica-server/interface-data";
import {ActionGuard, AuthGuard} from "@spica-server/passport-guard";
import {FUNCTION_LOG_REPOSITORY, LogRepository} from "@spica-server/interface-function-log";

@Controller("function-logs")
export class LogController {
  constructor(
    @Inject(FUNCTION_LOG_REPOSITORY) private logRepository: LogRepository,
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade
  ) {}

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]))
  logs(
    @Query("limit", NUMBER) limit: number,
    @Query("skip", NUMBER) skip: number,
    @Query("begin", DEFAULT(() => new Date().setUTCHours(0, 0, 0, 0)), DATE) begin: Date,
    @Query("end", DEFAULT(() => new Date().setUTCHours(23, 59, 59, 999)), DATE) end: Date,
    @Query("functions", ARRAY(String)) functions: string[],
    @Query("channel") channel: string,
    @Query("levels", ARRAY(Number)) levels: number[] = [],
    @Query("content") content: string
  ) {
    const where: ReadSpec["where"] = {};

    if (channel) {
      where.channel = {eq: channel};
    }

    if (levels.length) {
      where.level = {in: levels};
    }

    if (functions && functions.length) {
      where.function = {in: functions};
    }

    if (content) {
      where.content = {matches: content, caseInsensitive: true};
    }

    return this.queries.find("function_logs", {
      createdBetween: {from: begin, to: end},
      where,
      sort: {_id: -1},
      skip: skip > 0 ? skip : undefined,
      limit: limit > 0 ? limit : undefined,
      relations: ["function"]
    });
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("function:update", "function/:id"))
  async clearLogs(
    @Param("id") fnId: string,
    @Query("begin", DEFAULT(() => new Date(0)), DATE) begin: Date,
    @Query("end", DEFAULT(() => new Date().setUTCHours(23, 59, 59, 999)), DATE) end: Date,
    @Query("levels", ARRAY(Number)) levels: number[] = []
  ) {
    const deletedCount = await this.logRepository.deleteByFunction(fnId, {
      createdBetween: {from: begin, to: end},
      levels
    });
    if (!deletedCount) {
      throw new NotFoundException(`Log for function with ID ${fnId} not found`);
    }
  }
}
