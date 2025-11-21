import {PipelineBuilder} from "@spica-server/database/pipeline";
import {Activity} from "@spica-server/interface/activity";
import {Filter} from "@spica-server/database";

export class ActivityPipelineBuilder extends PipelineBuilder {
  attachAuthLookups(): this {
    this.attachAggregation("identity", "identifier");
    this.attachAggregation("user", "username");
    return this;
  }

  filterActivity(filter: Filter<Activity>): this {
    this.attachToPipeline(this.isFilterObject(filter), {$match: filter});
    this.isFilterApplied = this.isFilterObject(filter);
    return this;
  }

  private isFilterObject(obj: any): boolean {
    return typeof obj === "object" && !Array.isArray(obj) && !!Object.keys(obj).length;
  }

  private attachAggregation(moduleName: string, localField: string) {
    const lookupStage = {
      $lookup: {
        from: moduleName,
        localField: localField,
        foreignField: "_id",
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

    this.attachToPipeline(true, lookupStage, unwindStage, setStage);
    return this;
  }
}
