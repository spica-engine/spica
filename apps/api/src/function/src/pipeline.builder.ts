import {ObjectId} from "../../../../../libs/database";
import {PipelineBuilder} from "../../../../../libs/database/pipeline";
import {EnvRelation} from "../../../../../libs/interface/function";

export class FunctionPipelineBuilder extends PipelineBuilder {
  resolveEnvRelation(shouldResolve: EnvRelation) {
    const aggregation = {
      $lookup: {
        from: "env_var",
        localField: "env_vars",
        foreignField: "_id",
        as: "env_vars"
      }
    };
    return this.attachToPipeline(shouldResolve == EnvRelation.Resolved, aggregation);
  }

  filterByEnvVars(envVars: ObjectId[]) {
    const filter = {
      $match: {
        env_vars: {
          $in: envVars
        }
      }
    };
    return this.attachToPipeline(envVars && envVars.length, filter);
  }
}
