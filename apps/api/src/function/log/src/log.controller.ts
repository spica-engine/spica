import {
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
import {ARRAY, DATE, DEFAULT, NUMBER} from "@spica-server/core";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard} from "@spica-server/passport/guard";
import {LogService} from "./log.service";

@Controller("function-logs")
export class LogController {
  constructor(private logService: LogService) {}

  @Get()
  @UseGuards(AuthGuard())
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
    const match: any = {
      _id: {
        $gte: ObjectId.createFromTime(begin.getTime() / 1000),
        $lt: ObjectId.createFromTime(end.getTime() / 1000)
      }
    };

    if (channel) {
      match.channel = channel;
    }

    if (levels.length) {
      match.level = {
        $in: levels
      };
    }

    if (functions && functions.length) {
      match.function = {
        $in: functions
      };
    }

    if (content) {
      match.content = {$regex: content, $options: "i"};
    }

    const pipeline: any[] = [
      {
        $match: match
      },
      {
        $lookup: {
          from: "function",
          let: {fn: {$toObjectId: "$function"}},
          pipeline: [{$match: {$expr: {$eq: ["$_id", "$$fn"]}}}],
          as: "fn"
        }
      },
      {$unwind: "$fn"},
      {$set: {function: "$fn.name"}},
      {$unset: ["fn"]}
    ];

    pipeline.push({$sort: {_id: -1}});

    if (skip > 0) {
      pipeline.push({$skip: skip});
    }

    if (limit > 0) {
      pipeline.push({$limit: limit});
    }

    return this.logService.aggregate(pipeline).toArray();
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("function:update", "function/:id"))
  async clearLogs(
    @Param("id") fnId: string,
    @Query("begin", DEFAULT(() => new Date(0)), DATE) begin: Date,
    @Query("end", DEFAULT(() => new Date().setUTCHours(23, 59, 59, 999)), DATE) end: Date,
    @Query("levels", ARRAY(Number)) levels: number[] = []
  ) {
    const filter: any = {
      _id: {
        $gte: ObjectId.createFromTime(begin.getTime() / 1000),
        $lt: ObjectId.createFromTime(end.getTime() / 1000)
      },
      function: fnId
    };

    if (levels.length) {
      filter.level = {
        $in: levels
      };
    }

    const deletedCount = await this.logService.deleteMany(filter);
    if (!deletedCount) {
      throw new NotFoundException(`Log for function with ID ${fnId} not found`);
    }
  }
}
