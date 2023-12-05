import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Inject, Injectable} from "@nestjs/common";
import {ApiStatus, StatusOptions, STATUS_OPTIONS, InvocationStatus} from "./interface";
import {ObjectId} from "@spica-server/database";
import {PipelineBuilder} from "@spica-server/database/pipeline";

@Injectable()
export class StatusService extends BaseCollection<ApiStatus>("status") {
  moduleOptions: StatusOptions;
  constructor(db: DatabaseService, @Inject(STATUS_OPTIONS) _moduleOptions: StatusOptions) {
    super(db, {afterInit: () => this.upsertTTLIndex(_moduleOptions.expireAfterSeconds)});
    this.moduleOptions = _moduleOptions;
  }

  private byteToMb(bytes: number) {
    return parseFloat((bytes * Math.pow(10, -6)).toFixed(2));
  }

  async calculateHttpStatus(begin: Date, end: Date) {
    const pipeline: any[] = [
      {
        $group: {
          _id: null,
          request: {$sum: 1},
          uploaded: {$sum: "$request.size"},
          downloaded: {$sum: "$response.size"}
        }
      }
    ];

    if (isValidDate(begin) && isValidDate(end)) {
      pipeline.unshift({
        $match: {
          _id: {
            $gte: ObjectId.createFromTime(begin.getTime() / 1000),
            $lt: ObjectId.createFromTime(end.getTime() / 1000)
          }
        }
      });
    }

    const result = await super
      .aggregate<{request: number; downloaded: number; uploaded: number}>(pipeline)
      .toArray()
      .then(r => {
        return r.length ? r[0] : {request: 0, uploaded: 0, downloaded: 0};
      });
    return {
      request: {
        current: result.request,
        unit: "count"
      },
      uploaded: {
        current: this.byteToMb(result.uploaded),
        unit: "mb"
      },
      downloaded: {
        current: this.byteToMb(result.downloaded),
        unit: "mb"
      }
    };
  }
}

@Injectable()
export class InvocationService extends BaseCollection<InvocationStatus>("invocation_status") {
  moduleOptions: StatusOptions;
  constructor(db: DatabaseService, @Inject(STATUS_OPTIONS) _moduleOptions: StatusOptions) {
    super(db, {afterInit: () => this.upsertTTLIndex(_moduleOptions.expireAfterSeconds)});
    this.moduleOptions = _moduleOptions;
  }

  calculateInvocationStatus(module: string, begin?: Date, end?: Date) {
    const pipelineBuilder = new PipelineBuilder();

    pipelineBuilder.filterByIdRange(begin, end);

    pipelineBuilder.filterByUserRequest({
      module
    });

    pipelineBuilder.attachToPipeline(true, {
      $group: {
        _id: null,
        total: {$sum: 1}
      }
    });

    return this.aggregate<{total: number}>(pipelineBuilder.result())
      .next()
      .then(r => {
        return {
          unit: "count",
          current: r ? r.total : 0
        };
      });
  }

  findByModule(module: string, begin?: Date, end?: Date) {
    const pipeline = new PipelineBuilder();

    pipeline.filterByIdRange(begin, end);

    pipeline.filterByUserRequest({
      module
    });

    pipeline.setVisibilityOfFields({module: 0});

    return this.aggregate<InvocationStatus>(pipeline.result()).toArray();
  }
}

export function isValidDate(date) {
  return date instanceof Date && !isNaN(date.getTime());
}
