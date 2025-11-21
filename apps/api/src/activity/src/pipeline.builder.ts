import {PipelineBuilder} from "@spica-server/database/pipeline";
import {Activity} from "@spica-server/interface/activity";
import {Filter, ObjectId} from "@spica-server/database";

export class ActivityPipelineBuilder extends PipelineBuilder {
  filterByUserRequest(filter: {
    identifier?: string;
    username?: string;
    action?: number[];
    resource?: object;
    begin?: Date;
    end?: Date;
  }): Promise<this> {
    const normalized: Filter<Activity> = {
      ...(filter.identifier && {identifier: filter.identifier}),
      ...(filter.username && {username: filter.username}),
      ...(filter.resource && {resource: filter.resource}),
      ...(filter.action?.length && {action: {$in: filter.action}})
    };

    const [begin, end] = [filter.begin?.getTime(), filter.end?.getTime()];
    if (begin && end) {
      normalized._id = {
        $gte: ObjectId.createFromTime(begin / 1000),
        $lt: ObjectId.createFromTime(end / 1000)
      };
    }

    return super.filterByUserRequest(normalized);
  }

  resolveRelations(): this {
    this.attachLookupAggregation("identity", "identifier");
    this.attachLookupAggregation("user", "username");
    return this;
  }

  private attachLookupAggregation(
    targetCollection: string,
    localField: string,
    foreignField: string = "_id"
  ): this {
    const lookupStage = {
      $lookup: {
        from: targetCollection,
        localField: localField,
        foreignField: foreignField,
        as: localField
      }
    };

    const unwindStage = {
      $unwind: {path: `$${localField}`, preserveNullAndEmptyArrays: true}
    };

    const setStage = {
      $set: {
        [localField]: `$${localField}.${localField}`
      }
    };

    return this.attachToPipeline(true, lookupStage, unwindStage, setStage);
  }
}
